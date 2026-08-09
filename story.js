// ============================================================
// 咖喱図書館（ストーリーモード）専用ファイル
// ============================================================
// 【開発方針】
// ・本体（game.js）や既存のFirebaseルールには一切手を加えず、このファイルの中だけで開発を進める。
// ・Firebase接続（database/currentUid等）・セーブロード（saveGame/loadGame等）・
//   共通モーダル（showCustomAlert/showCustomConfirm等）・通貨変数（playerG/spicyCoin等）は
//   すべてgame.js側の既存グローバルをそのまま利用する（再実装・二重管理はしない）。
// ・game.html側の変更は、このファイルを読み込む<script>タグ1行のみで完結させる。
//   入り口ボタン等のDOM要素は、すべてこのファイルからJSで動的に追加する。
// ・STORY_LIBRARY_ENABLEDがfalseの間は、管理者以外のプレイヤーからは完全に見えない・
//   存在しないのと同じ状態（DOMに一切手を加えない）。
//   実装が完了したら、このフラグをtrueにするだけで全プレイヤーに公開できる。
// ・ただし開発中でも管理者アカウント（FEST_ADMIN_EXCLUDED_IDSに含まれるplayerId）だけは
//   入り口が見え、動作確認のために入れるようにする（下記isStoryLibraryAdminUser参照）。
// ・このファイルはgame.jsより後に読み込まれる前提（game.html内のscriptタグの順序に依存）。
// ・「咖喱図書館アンロック済みか」「想いの欠片の所持数」は今のところ端末ローカル（localStorage）のみで
//   管理している（Firebase・ルールに一切触れない方針を優先したため）。管理者用リセットボタンも同じ理由で
//   ゲーム内（対戦タブのボタン横）に仮設置している。複数端末をまたいだ管理や、専用の管理ツール
//   （admin.html等）からのリセットが必要な場合は、別途相談の上でクラウド化する。
// ・「想いの欠片」の自動付与（QRスキャン・調理・PC戦勝利など）は、game.js本体を一切編集せず、
//   game.js側の既存グローバル関数を「後からラップ（monkey patch）」する形で実現している
//   （installStoryKakeraHooks参照）。game.jsはトップレベルのfunction宣言＝window直下の
//   プロパティなので、story.js側からwindow.関数名を差し替えても、game.js内部からの
//   呼び出しは新しい（ラップ後の）関数を使うようになる。

const STORY_LIBRARY_ENABLED = false; // ← 完成して公開する時にtrueへ変更する

(function() {

    // 管理者判定：game.js側で既に定義されているFEST_ADMIN_EXCLUDED_IDS（管理者キャラID一覧）と
    // playerId（自分のプレイヤーID）をそのまま利用する。二重管理を避けるため、ここでは
    // 管理者IDのリストを新たに持たない。
    function isStoryLibraryAdminUser() {
        try {
            return typeof FEST_ADMIN_EXCLUDED_IDS !== 'undefined'
                && typeof playerId !== 'undefined'
                && FEST_ADMIN_EXCLUDED_IDS.includes(playerId);
        } catch (e) {
            return false;
        }
    }

    // 公開前は「管理者のみ入り口が見える」状態にする。
    // 一般プレイヤー（管理者以外）には、STORY_LIBRARY_ENABLEDがtrueになるまでDOM操作を一切行わない。
    const storyLibraryDevPreview = !STORY_LIBRARY_ENABLED && isStoryLibraryAdminUser();
    if (!STORY_LIBRARY_ENABLED && !storyLibraryDevPreview) return;

    // ===== 咖喱図書館：章データ =====
    // 表紙: story/book-01.png〜book-10.png / 裏表紙: story/book2-01.png〜book2-10.png
    // 個別の解放状態（どの巻を解放済みか）は端末のlocalStorageに永続化する（qr_story_unlocked_chapters）。
    const STORY_UNLOCKED_CHAPTERS_KEY = 'qr_story_unlocked_chapters';
    function getUnlockedChapterNumbers() {
        try {
            const arr = JSON.parse(localStorage.getItem(STORY_UNLOCKED_CHAPTERS_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }
    function markChapterUnlockedPersisted(num) {
        const arr = getUnlockedChapterNumbers();
        if (!arr.includes(num)) {
            arr.push(num);
            try { localStorage.setItem(STORY_UNLOCKED_CHAPTERS_KEY, JSON.stringify(arr)); } catch (e) {}
        }
    }

    // 「最後まで読み終えたか」「本のボスを倒したか」も、解放状態と同じく端末ローカルで永続化する。
    // 読了で表紙にeyes.gifを重ね、「読む」ボタンは（ボスが設定されている巻に限り）「戦う」に変わる。
    // ボス撃破後は「再読」に変わる（再読しても報酬は再度もらえない＝done()側は毎回付与するが、
    // ボタンの見た目上は「読了済みの本を読み返す」体験として扱う）。
    const STORY_READ_CHAPTERS_KEY = 'qr_story_read_chapters';
    const STORY_CLEARED_CHAPTERS_KEY = 'qr_story_cleared_chapters';
    function getReadChapterNumbers() {
        try {
            const arr = JSON.parse(localStorage.getItem(STORY_READ_CHAPTERS_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function hasStoryChapterBeenRead(num) {
        return getReadChapterNumbers().includes(num);
    }
    function markStoryChapterRead(num) {
        const arr = getReadChapterNumbers();
        if (!arr.includes(num)) {
            arr.push(num);
            try { localStorage.setItem(STORY_READ_CHAPTERS_KEY, JSON.stringify(arr)); } catch (e) {}
        }
    }
    function getClearedChapterNumbers() {
        try {
            const arr = JSON.parse(localStorage.getItem(STORY_CLEARED_CHAPTERS_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function hasStoryChapterBeenCleared(num) {
        return getClearedChapterNumbers().includes(num);
    }
    function markStoryChapterCleared(num) {
        const arr = getClearedChapterNumbers();
        if (!arr.includes(num)) {
            arr.push(num);
            try { localStorage.setItem(STORY_CLEARED_CHAPTERS_KEY, JSON.stringify(arr)); } catch (e) {}
        }
    }

    const STORY_CHAPTER_COUNT = 10;
    const STORY_CHAPTERS = [];
    const _storyUnlockedNums = getUnlockedChapterNumbers();
    for (let i = 1; i <= STORY_CHAPTER_COUNT; i++) {
        const num = String(i).padStart(2, '0');
        STORY_CHAPTERS.push({
            num: i,
            frontImage: 'story/book-' + num + '.png',
            backImage: 'story/book2-' + num + '.png',
            locked: !_storyUnlockedNums.includes(i),
            unlockCost: i <= 8 ? 50 : null, // book-01〜08は想いの欠片50個で解放。09/10は解放条件を後日設定
        });
    }
    const STORY_FLOAT_INTENSITY = 22;
    const STORY_AUTO_ROTATE_SPEED = 0.045; // 1フレームあたりの回転角度（度）
    const STORY_BGM_SRC = 'story/library-bgm.mp3';
    const STORY_STAGE_REF_WIDTH = 500; // 本棚の3D演出はこの基準幅で設計されている
    const STORY_LIBRARYMAN_IMG = 'story/libraryman01.png';
    const STORY_MESSAGE_SE = 'sound/message.mp3';
    const STORY_BOOK_FALL_SE = 'story/buon.mp3';
    const STORY_TYPE_INTERVAL_MS = 45;
    const STORY_READER_PAGE_ENTRY_DELAY_MS = 1000; // 本編：各ページ表示後、文章が出るまでの無音の間
    // デバッグ用：読書画面に小さく表示するビルド番号。デプロイのたびに更新し、実機で本当に
    // 最新のstory.jsが読み込まれているか（キャッシュが残っていないか）を目視確認できるようにする。
    // 一般公開（STORY_LIBRARY_ENABLED=true）前には削除すること。
    const STORY_ENGINE_BUILD = 'b41';
    const STORY_UNLOCK_STORAGE_KEY = 'qr_story_library_unlocked';
    const STORY_BOOK_SPAWN_STAGGER_MS = 90;
    const STORY_BOOK_SPAWN_DURATION_MS = 550;
    const STORY_BOOK_REVEAL_WAIT_MS = 2000; // 本が降ってくる演出と次のセリフが重ならないよう待つ時間
    const STORY_SPEAKER_NAME = '館長';

    const STORY_ACCEPT_TEXT = '「お前が読むべき本はこの10冊だ。\n好きな本から読むといい」';
    const STORY_DECLINE_TEXT = '「そうか、残念だ」';

    function getStoryPlayerName() {
        try {
            return (typeof playerName === 'string' && playerName) ? playerName : 'プレイヤー';
        } catch (e) {
            return 'プレイヤー';
        }
    }

    // 初回案内で表示する会話ページ。プレイヤー名を差し込むため、開始時に毎回組み立て直す。
    // 選択肢を選んだ後の続き（お前が読むべき本は…／そうか、残念だ。）はonChoiceSelected()で
    // その場でキューに追加する（分岐先を静的配列にせず動的に組み立てる）。
    function buildStoryIntroPages() {
        const name = getStoryPlayerName();
        return [
            { text: '「よく来たな' + name + '。\n待っていたぞ」' },
            { text: '「ここか？ ここは咖喱図書館。\n人々の様々なカレーの想いが\nここの本には込められている」' },
            { text: '「どうだ？' + name + 'も読んでみないか？」', choices: [
                { label: 'はい', value: true },
                { label: 'いいえ', value: false },
            ] },
        ];
    }

    // ===== 想いの欠片 =====
    const STORY_KAKERA_STORAGE_KEY = 'qr_story_kakera_count';
    const STORY_KAKERA_MAX = 100;
    // 0=未開始 / 1=本の拡大画面での説明済み（本棚に戻るのを待っている）/
    // 2=本棚での説明済み（想いの欠片タップ待ち）/ 3=一覧を見た後、最後のセリフ再生中 / 4=完了
    const STORY_KAKERA_ONBOARD_KEY = 'qr_story_kakera_onboard_stage';
    // 想いの欠片の入手方法一覧を初めて表示した時だけ、館長の一言セリフを挟むためのフラグ。
    const STORY_KAKERA_INFO_SEEN_KEY = 'qr_story_kakera_info_seen';

    const STORY_KAKERA_SOURCES = [
        ['QRスキャン', '1個'],
        ['調理', '1個'],
        ['ログインボーナス', '3個'],
        ['QRビンゴ1列', '5個'],
        ['PC戦(初級)勝利', '3個'],
        ['PC戦(中級)勝利', '5個'],
        ['タッグ戦勝利', '5個'],
        ['ルーム戦勝利', '5個'],
        ['カレーフェス10連勝ごと', '5個'],
        ['宅配カレー使用される', '1個'],
        ['宅配カレー完食される', '10個'],
    ];

    function getStoryKakera() {
        try {
            const v = parseInt(localStorage.getItem(STORY_KAKERA_STORAGE_KEY), 10);
            return isNaN(v) ? 0 : v;
        } catch (e) {
            return 0;
        }
    }
    function setStoryKakera(v) {
        const clamped = Math.max(0, Math.min(STORY_KAKERA_MAX, v));
        try { localStorage.setItem(STORY_KAKERA_STORAGE_KEY, String(clamped)); } catch (e) {}
        updateKakeraDisplays();
        return clamped;
    }
    // 今後の自動付与（QRスキャン・調理等）はここを通す。表記や通知は出さず、ひっそり増やすだけ。
    function addStoryKakera(n) {
        if (!n) return;
        setStoryKakera(getStoryKakera() + n);
    }
    // 咖喱図書館側の演出として明示的に付与する場合（初回30個プレゼント等）は通知付き。
    function addStoryKakeraWithNotice(n) {
        const before = getStoryKakera();
        const after = setStoryKakera(before + n);
        const gained = after - before;
        if (gained > 0 && typeof showCustomAlert === 'function') {
            showCustomAlert('想いの欠片', '想いの欠片を' + gained + '個入手しました！');
        }
    }

    function getKakeraOnboardStage() {
        try {
            const v = parseInt(localStorage.getItem(STORY_KAKERA_ONBOARD_KEY), 10);
            return isNaN(v) ? 0 : v;
        } catch (e) {
            return 0;
        }
    }
    function setKakeraOnboardStage(v) {
        try { localStorage.setItem(STORY_KAKERA_ONBOARD_KEY, String(v)); } catch (e) {}
    }

    function hasSeenKakeraInfoIntro() {
        try {
            return localStorage.getItem(STORY_KAKERA_INFO_SEEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    }
    function setKakeraInfoIntroSeen(v) {
        try { localStorage.setItem(STORY_KAKERA_INFO_SEEN_KEY, v ? '1' : '0'); } catch (e) {}
    }

    // 「初めてどれか1冊を読み終え、戦う/eyes.gifが使えるようになった」館長のセリフを
    // 見せたかどうか（本の番号は問わず、端末で一度だけ）。
    const STORY_BOOK_BOSS_INTRO_SEEN_KEY = 'qr_story_book_boss_intro_seen';
    function hasSeenBookBossIntro() {
        try {
            return localStorage.getItem(STORY_BOOK_BOSS_INTRO_SEEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    }
    function setBookBossIntroSeen(v) {
        try { localStorage.setItem(STORY_BOOK_BOSS_INTRO_SEEN_KEY, v ? '1' : '0'); } catch (e) {}
    }

    // game.js本体には一切手を加えず、既存のグローバル関数を後から差し替えて（monkey patch）
    // 「その関数が呼ばれたタイミングで想いの欠片を加算する」ためのユーティリティ。
    // game.js側のfunction宣言はwindow直下のプロパティになるため、window.<name>を差し替えるだけで
    // game.js内部からの呼び出しも新しい関数に差し替わる（呼び出し側のコードは一切変更不要）。
    function wrapGlobalFn(name, makeWrapped) {
        try {
            const orig = window[name];
            if (typeof orig !== 'function' || orig.__storyWrapped) return;
            const wrapped = makeWrapped(orig);
            wrapped.__storyWrapped = true;
            window[name] = wrapped;
        } catch (e) {}
    }

    function installStoryKakeraHooks() {
        if (window.__storyKakeraHooksInstalled) return;
        window.__storyKakeraHooksInstalled = true;

        // QRスキャン成功：+1
        wrapGlobalFn('onQRScanned', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                addStoryKakera(1);
                return r;
            };
        });

        // 調理：+1
        wrapGlobalFn('onCookDone', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                addStoryKakera(1);
                return r;
            };
        });

        // ログインボーナス：+3（未取得→取得済みに変わった時だけ加算し、二重付与を防ぐ）
        wrapGlobalFn('claimLoginBonus', function(orig) {
            return function() {
                let before = null;
                try { before = typeof getLoginData === 'function' ? !!getLoginData().claimed : null; } catch (e) {}
                const r = orig.apply(this, arguments);
                try {
                    if (before === false && typeof getLoginData === 'function' && getLoginData().claimed) {
                        addStoryKakera(3);
                    }
                } catch (e) {}
                return r;
            };
        });

        // QRビンゴ1列達成：+5（同時に複数列揃った場合は列数分）
        wrapGlobalFn('onItemObtainedForBingo', function(orig) {
            return function() {
                let beforeLen = 0;
                try { beforeLen = (typeof getBingoData === 'function' && getBingoData()) ? getBingoData().completedLines.length : 0; } catch (e) {}
                const r = orig.apply(this, arguments);
                try {
                    const afterLen = (typeof getBingoData === 'function' && getBingoData()) ? getBingoData().completedLines.length : beforeLen;
                    const diff = afterLen - beforeLen;
                    if (diff > 0) addStoryKakera(diff * 5);
                } catch (e) {}
                return r;
            };
        });

        // PC戦(初級)勝利：+3 / PC戦(中級)勝利：+5
        wrapGlobalFn('onBattleWin', function(orig) {
            return function(kind) {
                const r = orig.apply(this, arguments);
                if (kind === 'bot') addStoryKakera(3);
                else if (kind === 'hard') addStoryKakera(5);
                return r;
            };
        });

        // タッグ戦勝利：+5
        wrapGlobalFn('tagFinishBattle', function(orig) {
            return function(result) {
                const r = orig.apply(this, arguments);
                if (result === 'win') addStoryKakera(5);
                return r;
            };
        });

        // ルーム戦（対人戦）勝利：+5。bot戦との判定はisBotMatch（game.js側のグローバル変数）で見分ける。
        wrapGlobalFn('done', function(orig) {
            return function(pHP, oHP) {
                let roomWin = false;
                try {
                    const isWin = pHP > oHP;
                    roomWin = isWin && (typeof isBotMatch !== 'undefined') && !isBotMatch;
                } catch (e) {}
                const r = orig.apply(this, arguments);
                if (roomWin) addStoryKakera(5);
                return r;
            };
        });

        // カレーフェス10連勝ごと：+5
        wrapGlobalFn('festBattleWin', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                try {
                    if (typeof festWinStreak === 'number' && festWinStreak > 0 && festWinStreak % 10 === 0) {
                        addStoryKakera(5);
                    }
                } catch (e) {}
                return r;
            };
        });

        // 宅配カレー使用される：+1（自分の端末がログイン時等に受け取り一覧を処理したタイミングで加算）
        wrapGlobalFn('processDeliveryRewards', function(orig) {
            return function(rewards) {
                try {
                    if (Array.isArray(rewards)) {
                        const usedCount = rewards.filter(function(r) { return r && !r.eatenUp; }).length;
                        if (usedCount > 0) addStoryKakera(usedCount);
                    }
                } catch (e) {}
                return orig.apply(this, arguments);
            };
        });

        // 宅配カレー完食される：+10
        wrapGlobalFn('handleEatenUpEntry', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                addStoryKakera(10);
                return r;
            };
        });
    }

    // 本体（game.js）のtoggleMute/setMuteStateはbattleBGM（単一BGMチャンネル）しか止めないため、
    // このファイル独自の環境音（雨音・蝉など、playStoryAmbient）や効果音（playStorySE）は
    // ミュートをONにしても鳴り続けてしまう。game.js本体には一切手を加えず、既存のグローバル関数を
    // 後から差し替えて（monkey patch）、ミュートON時にこのファイル独自の音声もまとめて止める。
    function installStoryMuteHooks() {
        if (window.__storyMuteHooksInstalled) return;
        window.__storyMuteHooksInstalled = true;

        wrapGlobalFn('toggleMute', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                if (typeof isMuted !== 'undefined' && isMuted) {
                    stopStoryAmbient();
                    stopAllStorySE();
                }
                return r;
            };
        });

        wrapGlobalFn('setMuteState', function(orig) {
            return function(mute) {
                const r = orig.apply(this, arguments);
                if (mute) {
                    stopStoryAmbient();
                    stopAllStorySE();
                }
                return r;
            };
        });
    }

    const storyLibraryState = {
        overlayEl: null,
        rafId: null,
        rotationY: 0,
        t: 0,
        dragging: false,
        dragMoved: false,
        startX: 0,
        startRot: 0,
        mode: 'carousel', // 'carousel' | 'intro_wait_tap' | 'intro_dialogue'
        unlocked: false,
        booksRevealed: false,
        pendingUnlock: false,
        dialogueQueue: [],
        dialogueIndex: 0,
        onDialogueEnd: null,
        typingTimer: null,
        typingText: '',
        typingIndex: 0,
        typingDone: true,
        pendingChoices: null,
        revealStartTs: 0,
        dialogueStarting: false, // 館長の登場演出～セリフ開始までの待ち時間中はタップを無視するためのフラグ
        bookBossIntroActive: false, // 初めて戦う/eyes.gifが出た時の館長のセリフ中。×・戦うボタンを無効化する
        dialogueSession: 0, // 会話セッションの世代番号（連続して次の会話に繋げた時、古いsetTimeoutが誤って新しい会話を隠さないようにする）
        currentDetailChapter: null, // 現在、拡大表示中の本（解放／読むボタンの対象）
        // ===== 本編（各巻ストーリー）再生用 =====
        readerPages: [], // 再生中の本のページ配列（STORY_BOOK_SCRIPTS[num]）
        readerPageIndex: 0, // 現在表示中のページ番号（0始まり）
        readerBeatIndex: 0, // ページ内、現在表示中のテキスト（挿絵下の文章 or セリフ）の位置
        readerChapter: null, // 現在読んでいる本（STORY_CHAPTERSの1件）
        readerBgmSrc: null, // 本編再生中に鳴っているBGM（同じ曲への再指定で再生し直さないようにするため）
        readerBusy: false, // ページ開始直後の間・演出中のタップ無視フラグ（間/delay/制御用beatの自動進行中はtrue）
        readerCloseDisabled: false, // trueの間、本編読書中の×・戻るボタンを無効にする（演出上、離脱させたくない場面用）
        ambientAudio: null, // 雨音などの環境音（BGMとは別レイヤーで、重ねてループ再生する用のAudio要素）
        activeSeAudios: [], // 本編再生中に鳴らした効果音（Audio要素）。×で閉じた時にまとめて止めるため自前で保持する。
        // ===== 本のボス戦 =====
        inBookBossBattle: false, // 本のボス戦の準備中（vsカットイン）〜終了までtrue。#vsCutIn/#battleArenaのz-index持ち上げ管理用。
        bookBossChapter: null, // 現在挑戦中の本（STORY_CHAPTERSの1件）
    };

    // ===== 初期化 =====
    function initStoryLibrary() {
        injectStoryLibraryStyles();
        injectStoryLibraryFont();
        injectStoryLibraryEntryButton();
        installStoryKakeraHooks();
        installBookBossHooks();
        installStoryMuteHooks();
        // 今後、咖喱図書館の初期化処理（セーブデータの読み込み等）をここに追加していく
    }

    // 対戦タブ（カレーフェスボタンの並び）に入り口ボタンを動的に追加する。
    // ※あくまで仮の設置場所。実装が進む段階で適切な場所へ調整する想定。
    function injectStoryLibraryEntryButton() {
        const anchor = document.getElementById('btnCurryFes');
        if (!anchor || !anchor.parentNode) return;
        const btn = document.createElement('button');
        btn.id = 'btnStoryLibrary';
        btn.className = 'btn-bot-img';
        btn.onclick = openStoryLibrary;
        btn.style.cssText = 'flex:1; min-height:40px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:linear-gradient(135deg,#8a5a3c,#5c3a24); color:#fff8ec; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.25); font-weight:bold; padding:4px;';
        btn.innerHTML = '<span style="font-size:13px;">📚 咖喱図書館</span>'
            + (storyLibraryDevPreview ? '<span style="font-size:9px; opacity:0.85;">（開発中・管理者のみ）</span>' : '');
        anchor.parentNode.appendChild(btn);

        // 管理者用：咖喱図書館の進行状況（この端末のみ）をリセットするボタン。
        // 動作確認のたびに毎回初回案内から見直せるようにするための仮設置。
        if (storyLibraryDevPreview) {
            const resetBtn = document.createElement('button');
            resetBtn.id = 'btnStoryLibraryReset';
            resetBtn.title = '咖喱図書館リセット（管理者用・この端末のみ）';
            resetBtn.style.cssText = 'flex:0 0 34px; min-height:40px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.15); color:#5c3a24; border-radius:6px; font-size:15px; margin-left:2px; border:none; cursor:pointer;';
            resetBtn.textContent = '🔄';
            resetBtn.onclick = onStoryLibraryResetClick;
            anchor.parentNode.appendChild(resetBtn);
        }
    }

    function onStoryLibraryResetClick() {
        const doReset = function() {
            localStorage.removeItem(STORY_UNLOCK_STORAGE_KEY);
            localStorage.removeItem(STORY_KAKERA_STORAGE_KEY);
            localStorage.removeItem(STORY_KAKERA_ONBOARD_KEY);
            localStorage.removeItem(STORY_KAKERA_INFO_SEEN_KEY);
            localStorage.removeItem(STORY_UNLOCKED_CHAPTERS_KEY);
            localStorage.removeItem(STORY_READ_CHAPTERS_KEY);
            localStorage.removeItem(STORY_CLEARED_CHAPTERS_KEY);
            localStorage.removeItem(STORY_BOOK_BOSS_INTRO_SEEN_KEY);
            STORY_CHAPTERS.forEach(function(chapter) {
                chapter.locked = true;
                if (chapter._lockEl) chapter._lockEl.style.display = '';
                updateStoryBookReadVisual(chapter);
            });
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('🔄 咖喱図書館リセット', 'リセットしました。次回入場時に最初から案内が始まります。');
            }
        };
        const msg = '管理者用：この端末の咖喱図書館の進行状況（本棚の解放状況・想いの欠片を含む）をリセットします。よろしいですか？';
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('🔄 咖喱図書館リセット', msg, doReset);
        } else if (confirm(msg)) {
            doReset();
        }
    }

    // 「咖喱」等のCJK漢字が端末フォントによっては表示できない場合があるため、
    // 収録範囲の広いWebフォント（Noto Sans SC）を咖喱図書館関連の要素にのみ適用する。
    function injectStoryLibraryFont() {
        if (document.getElementById('storyLibraryFontLink')) return;
        const pre1 = document.createElement('link');
        pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
        const pre2 = document.createElement('link');
        pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
        const link = document.createElement('link');
        link.id = 'storyLibraryFontLink';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap';
        document.head.appendChild(pre1);
        document.head.appendChild(pre2);
        document.head.appendChild(link);
    }

    function injectStoryLibraryStyles() {
        if (document.getElementById('storyLibraryStyles')) return;
        const style = document.createElement('style');
        style.id = 'storyLibraryStyles';
        style.textContent = `
#storyLibraryOverlay, #btnStoryLibrary, #btnStoryLibraryReset {
    font-family:'Noto Sans SC','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;
}
#storyLibraryOverlay { position:fixed; inset:0; z-index:9999; background:#000; }
#storyLibraryStage {
    position:relative; width:100%; max-width:500px; height:100%; margin:0 auto;
    background-image:url('story/currylibrary_bg2.png'); background-size:cover; background-position:center;
    overflow:hidden; touch-action:none; user-select:none; cursor:grab;
}
#storyLibraryPerspective { position:absolute; inset:0; perspective:1400px; z-index:1; }
#storyBooksWrap { position:absolute; top:56%; left:50%; width:0; height:0; transform-style:preserve-3d; }
.story-book-wrapper { position:absolute; top:0; left:0; width:0; height:0; transform-style:preserve-3d; }
.story-book-inner {
    position:absolute; width:102px; height:144px; transform-style:preserve-3d; cursor:pointer;
}
.story-book-front, .story-book-back {
    position:absolute; inset:0; border-radius:5px; overflow:hidden; background-color:#3a2c1f;
    background-size:cover; background-position:center;
    box-shadow:0 30px 45px -20px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.08);
}
.story-book-lock {
    position:absolute; inset:0; z-index:3; border-radius:5px; overflow:hidden;
    background-image:url('story/booklock.png'); background-size:cover; background-position:center;
}
.story-book-detail-lock {
    position:absolute; inset:0; z-index:3; border-radius:8px; overflow:hidden;
    background-image:url('story/booklock.png'); background-size:cover; background-position:center;
}
/* 解放時：鍵が光ってから消えていく演出 */
@keyframes storyLockGlow {
    0% { filter:brightness(1) drop-shadow(0 0 0 rgba(255,240,200,0)); opacity:1; }
    50% { filter:brightness(2.4) drop-shadow(0 0 16px rgba(255,240,200,0.95)); opacity:1; }
    100% { filter:brightness(2.6) drop-shadow(0 0 24px rgba(255,240,200,0.95)); opacity:0; }
}
.story-book-lock-unlocking { animation:storyLockGlow 0.7s ease-in forwards; }
#storyLibraryCloseBtn {
    position:absolute; top:16px; left:16px; z-index:30; width:36px; height:36px; border-radius:999px;
    background:rgba(0,0,0,0.45); color:#fff; border:1px solid rgba(255,255,255,0.4); font-size:16px;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
}
#storyMuteBtn {
    position:absolute; top:8px; right:8px; width:32px; height:32px; border:none; background:transparent;
    cursor:pointer; z-index:30; display:flex; align-items:center; justify-content:center; padding:0;
}
#storyMuteBtn img { width:28px; height:28px; }
#storyKakeraCounter {
    position:absolute; top:16px; left:50%; transform:translateX(-50%); z-index:12;
    background:rgba(0,0,0,0.45); color:#fff; font-size:12px; font-weight:bold;
    padding:6px 14px; border-radius:999px; cursor:pointer; display:none; white-space:nowrap;
}
#storyBookDetailOverlay {
    position:absolute; inset:0; background:rgba(250,248,244,0.92); backdrop-filter:blur(10px);
    z-index:20; display:flex; align-items:center; justify-content:center;
}
/* width/max-widthはcolumn側に持たせる（cardのwidth:60%がここに対して解決されるようにするため。
   カードに直接持たせると、親（column）が中身に合わせて幅を決める関係で循環し、意図せず縮んでしまう）。 */
#storyBookDetailColumn { display:flex; flex-direction:column; align-items:center; gap:18px; width:60%; max-width:260px; }
/* 本棚側の想いの欠片バッジ（storyKakeraCounter）と同じ見た目にする */
#storyBookDetailKakera {
    background:rgba(0,0,0,0.45); color:#fff; font-size:12px; font-weight:bold;
    padding:6px 14px; border-radius:999px; white-space:nowrap; display:none;
}
.story-book-detail-cover {
    position:relative; width:100%; aspect-ratio:0.72; border-radius:8px; background-color:#3a2c1f;
    background-size:cover; background-position:center;
    box-shadow:0 40px 60px -20px rgba(0,0,0,0.3);
}
/* 「読む」を押した瞬間、表紙が光ってから本編にホワイトアウトで切り替わる演出 */
@keyframes storyBookOpeningGlow {
    0% { filter:brightness(1) drop-shadow(0 0 0 rgba(255,240,200,0)); }
    100% { filter:brightness(2.2) drop-shadow(0 0 26px rgba(255,240,200,0.9)); }
}
.story-book-opening-glow { animation:storyBookOpeningGlow 0.42s ease-in forwards; }
#storyBookDetailActionRow {
    display:flex; gap:10px; justify-content:center; align-items:center; flex-wrap:wrap;
}
#storyBookDetailActionBtn {
    background:rgba(35,28,18,0.85); color:#fff; border:1px solid rgba(255,255,255,0.4);
    border-radius:999px; padding:10px 34px; font-size:14px; font-weight:bold; cursor:pointer;
    box-shadow:0 8px 20px rgba(0,0,0,0.25); display:none;
}
#storyBookDetailActionBtn:active { background:rgba(60,48,32,0.9); }
#storyBookDetailActionBtn.story-book-action-disabled { opacity:0.5; cursor:default; }
/* 再戦ボタン：撃破済みの本で「再読」の横に並べて表示する（クリア後、何度でも同じボスと再戦できる）。 */
#storyBookDetailRebattleBtn {
    background:rgba(140,40,30,0.85); color:#fff; border:1px solid rgba(255,255,255,0.4);
    border-radius:999px; padding:10px 28px; font-size:14px; font-weight:bold; cursor:pointer;
    box-shadow:0 8px 20px rgba(0,0,0,0.25); display:none;
}
#storyBookDetailRebattleBtn:active { background:rgba(170,50,35,0.9); }
/* 本棚に戻る×。本の表紙表示中は、咖喱図書館から出る×（storyLibraryCloseBtn）と同じ左上の位置に表示し、
   紛らわしい2つの×が同時に出ないようにする（storyLibraryCloseBtn側はopenStoryBookDetail()内で非表示にする）。 */
#storyBookDetailCloseBtn {
    position:absolute; top:16px; left:16px; z-index:30; width:36px; height:36px; border-radius:999px;
    background:rgba(0,0,0,0.45); color:#fff; border:1px solid rgba(255,255,255,0.4); font-size:16px;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
}
/* 想いの欠片の入手方法一覧 */
#storyKakeraInfoOverlay {
    position:absolute; inset:0; background:rgba(250,248,244,0.94); backdrop-filter:blur(10px);
    z-index:26; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;
}
#storyKakeraInfoCard {
    background:#fff; border-radius:12px; padding:20px 22px; max-width:320px; width:100%;
    box-shadow:0 20px 40px rgba(0,0,0,0.25); color:#3a2c1f; font-size:13px; line-height:1.6;
}
#storyKakeraInfoCard h3 { margin:0 0 12px; font-size:15px; }
.story-kakera-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.08); }
.story-kakera-row:last-child { border-bottom:none; }
#storyKakeraInfoCloseBtn {
    position:absolute; top:16px; left:16px; z-index:30; width:36px; height:36px; border-radius:999px;
    background:rgba(0,0,0,0.45); color:#fff; border:1px solid rgba(255,255,255,0.4); font-size:16px;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
}

/* ===== 初回案内（店主との会話） ===== */
/* storyBookDetailOverlay(20)より上に、閉じるボタン(30)より下に表示する（本の拡大画面の上にも重ねられるように）。 */
/* pointer-events:noneにして、セリフ表示中でも下にある要素（想いの欠片カウンター等）へのタップを
   透過させる。実際にタップ操作が必要な子要素（選択肢ボタン等）だけpointer-events:autoで復活させる。 */
/* z-index:28にして、想いの欠片の入手方法一覧(26)より前面にセリフを重ねられるようにする。 */
#storyDialogueLayer { position:absolute; inset:0; z-index:28; display:none; pointer-events:none; }
.story-libraryman {
    position:absolute; left:50%; bottom:0; transform:translateX(-50%) scale(0.92); max-height:80%; max-width:88%;
    opacity:0; transition:opacity 0.4s ease, transform 0.4s ease; z-index:15;
}
.story-libraryman.story-man-visible { opacity:1; transform:translateX(-50%) scale(1); }
/* 3行想定の固定サイズ角丸ウインドウ。セリフの長さに関わらず高さは変えず、中でテキストが流れていく。 */
#storyMessageBox {
    position:absolute; left:14px; right:14px; bottom:14px; z-index:16; height:132px; box-sizing:border-box;
    background:rgba(35,28,18,0.85); color:#fff; border-radius:16px; padding:12px 18px 10px;
    font-size:15px; line-height:1.7; box-shadow:0 8px 24px rgba(0,0,0,0.35);
    display:none; flex-direction:column; justify-content:space-between;
}
#storyMessageText { white-space:pre-line; text-align:left; flex:1 1 auto; overflow:hidden; }
/* 話者名はウインドウの外（左上、枠線に重なる位置）に表示する。ウインドウの中身には含めない。 */
#storyMessageName {
    position:absolute; left:22px; bottom:134px; z-index:17; display:none;
    background:rgba(35,28,18,0.92); color:#ffd9a0; font-size:12px; font-weight:bold;
    padding:4px 14px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3);
}
#storyMessageArrow {
    text-align:right; font-size:14px; display:none; flex:none;
    animation:storyArrowBlink 1s steps(1) infinite;
}
@keyframes storyArrowBlink { 0%, 50% { opacity:1; } 50.01%, 100% { opacity:0; } }
/* 選択肢はメッセージウインドウの上に表示する */
#storyMessageChoices {
    position:absolute; left:14px; right:14px; bottom:156px; z-index:16; pointer-events:auto;
    display:none; gap:12px; justify-content:center;
}
.story-choice-btn {
    background:rgba(35,28,18,0.85); border:1px solid rgba(255,255,255,0.55); color:#fff;
    border-radius:10px; padding:10px 26px; font-size:14px; cursor:pointer;
    box-shadow:0 8px 20px rgba(0,0,0,0.3);
}
.story-choice-btn:active { background:rgba(60,48,32,0.9); }

/* ===== 本編（各巻ストーリー）再生画面 ===== */
/* storyLibraryPerspective(本棚,1)より上、storyBookDetailOverlay(20)より下に置く。
   セリフ表示はstoryDialogueLayer(28)を流用するので、その下にさえあれば十分。 */
#storyReaderOverlay { position:absolute; inset:0; z-index:8; display:none; background:#000; }
#storyReaderBg {
    position:absolute; inset:0; background-size:cover; background-position:center; background-color:#000;
}
/* 挿絵＋テキストエリアをまとめて縦に並べるコンテナ。flexで上から積む（絶対値のtopを別々に
   指定しないことで、挿絵の実際の高さに関わらずテキストが必ず挿絵の下に来るようにしている）。 */
#storyReaderContent {
    position:absolute; left:0; right:0; top:16%; bottom:14%; z-index:2;
    display:flex; flex-direction:column; align-items:center;
    padding:0 11%; box-sizing:border-box;
}
/* ページの挿絵（正方形1枚、横中央・縦中央よりやや上）を表示する枠。overflow:hiddenにして
   あるので、中のシルエット画像を大きく／端に寄せて表示すると自然に見切れる。 */
#storyReaderImageWrap {
    position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; flex:none; display:none;
}
/* 挿絵本体 */
#storyReaderImage { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
/* キャラクターシルエット。挿絵を置き換えるのではなく、挿絵の上に重ねて表示するレイヤー。
   x/y（中心位置）・width（大きさ）はbeatごとに指定でき、枠からはみ出た部分は自動的に見切れる。 */
#storyReaderSilhouette {
    position:absolute; left:50%; top:50%; width:70%; height:auto;
    transform:translate(-50%,-50%); display:none; pointer-events:none;
}
/* 挿絵の上に重ねる黒いオーバーレイ（回想の演出等で使用）。beat.overlayで表示/非表示を切り替える。 */
#storyReaderImageOverlay {
    position:absolute; inset:0; background:rgba(0,0,0,0.6); display:none; pointer-events:none;
    transition:opacity 0.3s ease;
}
/* 画面全体の暗転（エンディング等の演出用）。挿絵の枠だけでなくstoryReaderOverlay全体を覆う。 */
#storyReaderBlackout {
    position:absolute; inset:0; z-index:5; background:#000; opacity:0; pointer-events:none;
    transition:opacity 0.6s ease;
}
#storyReaderBlackout.story-reader-blackout-visible { opacity:1; }
/* 暗転時に画面中央へフェード表示するテキスト（挿絵下のテキストエリアとは別の表示方法） */
#storyReaderCenterText {
    position:absolute; inset:0; z-index:6; display:flex; align-items:center; justify-content:center;
    padding:0 12%; text-align:center; color:#fff; font-size:17px; line-height:2;
    white-space:pre-line; opacity:0; pointer-events:none; transition:opacity 0.6s ease;
}
#storyReaderCenterText.story-center-text-visible { opacity:1; }
/* 暗転（#storyReaderBlackout）中に、通常のセリフ表示（画面下のテキストエリアと同じ見た目・進め方）を
   前面に出したい時専用のレイヤー。#storyReaderTextAreaは親の#storyReaderContentがz-index:2で
   独自のスタッキングコンテキストを作ってしまっているため、子要素のz-indexをいくら上げても
   z-index:5の#storyReaderBlackoutより前面には出せない。そのためテキストエリアと同じ見た目を
   #storyReaderOverlay直下の別レイヤーとして用意し、暗転中のbeat.textはこちらに描画する。 */
#storyReaderBlackoutText {
    position:absolute; left:0; right:0; bottom:14%; z-index:9;
    max-height:60%; padding:0 12%; box-sizing:border-box;
    color:#fff; font-size:15px; line-height:1.85; text-align:left;
    white-space:pre-line; overflow-y:auto; display:none;
}
/* 挿絵の下の地の文エリア（絵本風）。タイプライターなし・効果音なしで、タップすると
   表示中の文章が次の文章に置き換わる（切り替え式）。全文を出し切った状態でタップするとページがめくれる。
   文章が長くページ内に収まらない場合は、このエリア内だけで縦スクロールできるようにしてある。 */
#storyReaderTextArea {
    width:100%; margin-top:18px; color:#2a2118; font-size:15px; line-height:1.85; text-align:left;
    white-space:pre-line; overflow-y:auto; flex:1 1 auto; min-height:0; display:none;
}
#storyReaderTextArrow {
    display:inline-block; margin-left:4px; animation:storyArrowBlink 1s steps(1) infinite;
}
/* 本編読書中専用の×（左上）。本棚/本の表紙の×と同じ見た目・位置で、常にどれか1つだけ表示する。 */
#storyReaderCloseBtn {
    position:absolute; top:16px; left:16px; z-index:30; width:36px; height:36px; border-radius:999px;
    background:rgba(0,0,0,0.45); color:#fff; border:1px solid rgba(255,255,255,0.4); font-size:16px;
    cursor:pointer; display:none; align-items:center; justify-content:center;
}
/* 前のページに戻るボタン（画面左端中央に常設）。表紙側の×・館長会話とは独立した本編専用の送り操作。 */
#storyReaderPrevBtn {
    position:absolute; left:8px; top:50%; transform:translateY(-50%); z-index:30;
    width:34px; height:34px; border-radius:999px;
    background:rgba(0,0,0,0.35); color:#fff; border:1px solid rgba(255,255,255,0.35); font-size:14px;
    cursor:pointer; display:none; align-items:center; justify-content:center;
}
/* デバッグ用の状態表示（実機で最新コードが読み込まれているか／今どのページ・beatで
   止まっているかを目視確認するための行）。画面上部中央に常時表示する。
   一般公開前に削除すること。 */
#storyReaderDebugLine {
    display:none; /* 一般公開向けに非表示化。デバッグ時はこの行を削除すれば復活できる */
    position:absolute; top:4px; left:50%; transform:translateX(-50%); z-index:33;
    background:rgba(0,0,0,0.6); color:#ffe6a8; font-size:11px; font-family:monospace;
    padding:2px 10px; border-radius:8px; pointer-events:none; white-space:nowrap; max-width:92%;
    overflow:hidden; text-overflow:ellipsis;
}
/* 表紙拡大画面→本編読書画面の切り替え時のホワイトアウト。全ての要素より前面（closeボタン等の30より上）。 */
#storyTransitionWhiteout {
    position:absolute; inset:0; z-index:35; background:#fff; opacity:0;
    pointer-events:none; transition:opacity 0.25s ease;
}

/* ===== 咖喱図書館：本のボス戦 ===== */
/* 読了済みの本の表紙に重ねる薄暗いオーバーレイ＋eyes.gif（横幅いっぱい・縦センター）。
   本棚側（.story-book-front直下）／拡大表紙側（#storyBookDetailCard直下）の両方で使う共通クラス。 */
.story-book-read-overlay {
    position:absolute; inset:0; z-index:4; display:none;
    background:rgba(0,0,0,0.55);
    align-items:center; justify-content:center; pointer-events:none;
}
.story-book-read-overlay img { width:100%; height:auto; display:block; }
/* vsカットイン／バトルアリーナを咖喱図書館の背景（#storyLibraryOverlay z-index:9999）より
   前面へ持ち上げるための目印クラス。本のボス戦の間だけ付与し、終了時に外す。
   PC（横幅の広いウィンドウ）でinset:0のまま画面幅いっぱいに広げるとUIが崩れるため、
   #container/#gameWrapperと同じ最大幅500pxに収め、中央寄せする（left:50%+transform）。 */
#vsCutIn.book-battle-lift, #battleArena.book-battle-lift {
    position:fixed !important;
    top:0 !important; bottom:0 !important;
    left:50% !important; transform:translateX(-50%) !important;
    width:100% !important; max-width:500px !important;
    z-index:10050 !important;
}
/* バトルの全体背景：咖喱図書館の専用バトル背景画像を敷く（.battle-stage.battle-bg-book側は
   透過のままにしてあるので、この画像がバトル画面全体にシームレスに見える）。 */
#battleArena.book-battle-lift {
    background:url('story/currylibrary_bg.png') center/cover !important;
    overflow-y:auto !important;
    padding:16px !important; box-sizing:border-box !important;
}
/* 本のボス戦：バトルステージ自体の背景画像は無し（他のPC戦用背景は使わない） */
.battle-stage.battle-bg-book { background:transparent !important; border:none !important; box-shadow:none !important; }
/* 本のボス戦：敵アイコンの丸トリミング・枠を解除し、画像をそのまま表示する */
#battleArena.book-boss-mode #oVisual {
    border-radius:0 !important; border:none !important; box-shadow:none !important;
    background:transparent !important; overflow:visible !important;
}
#battleArena.book-boss-mode #oVisual img {
    border-radius:0 !important; object-fit:contain !important; width:100% !important; height:100% !important;
}
        `;
        document.head.appendChild(style);
    }

    // 咖喱図書館のメイン画面表示（3D回転本棚UI＋初回案内）
    function openStoryLibrary() {
        if (storyLibraryState.overlayEl) return; // 既に開いている場合は何もしない
        buildStoryLibraryOverlay();
    }

    function isStoryLibraryUnlocked() {
        try {
            return localStorage.getItem(STORY_UNLOCK_STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }
    function setStoryLibraryUnlocked(v) {
        try {
            localStorage.setItem(STORY_UNLOCK_STORAGE_KEY, v ? '1' : '0');
        } catch (e) {}
    }

    function buildStoryLibraryOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'storyLibraryOverlay';
        overlay.innerHTML =
            '<div id="storyLibraryStage">'
            + '<div id="storyLibraryPerspective"><div id="storyBooksWrap"></div></div>'
            + '<div id="storyDialogueLayer">'
            + '<img id="storyLibraryman" class="story-libraryman" src="' + STORY_LIBRARYMAN_IMG + '" alt="">'
            + '<div id="storyMessageChoices"></div>'
            + '<div id="storyMessageName">' + STORY_SPEAKER_NAME + '</div>'
            + '<div id="storyMessageBox">'
            + '<div id="storyMessageText"></div>'
            + '<div id="storyMessageArrow">▼</div>'
            + '</div>'
            + '</div>'
            + '<button id="storyLibraryCloseBtn">✕</button>'
            + '<button id="storyMuteBtn"><img id="storyMuteIcon" src="sound-on.svg" alt="sound"></button>'
            + '<div id="storyKakeraCounter">想いの欠片:0個</div>'
            + '<div id="storyBookDetailOverlay" style="display:none;">'
            + '<button id="storyBookDetailCloseBtn">✕</button>'
            + '<div id="storyBookDetailColumn">'
            + '<div id="storyBookDetailKakera">想いの欠片:0個</div>'
            + '<div id="storyBookDetailCard"></div>'
            + '<div id="storyBookDetailActionRow">'
            + '<button id="storyBookDetailActionBtn"></button>'
            + '<button id="storyBookDetailRebattleBtn">再戦</button>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '<div id="storyKakeraInfoOverlay" style="display:none;">'
            + '<button id="storyKakeraInfoCloseBtn">✕</button>'
            + '<div id="storyKakeraInfoCard"></div>'
            + '</div>'
            + '<div id="storyReaderOverlay">'
            + '<div id="storyReaderBg"></div>'
            + '<div id="storyReaderContent">'
            + '<div id="storyReaderImageWrap">'
            + '<img id="storyReaderImage" alt="">'
            + '<img id="storyReaderSilhouette" alt="">'
            + '<div id="storyReaderImageOverlay"></div>'
            + '</div>'
            + '<div id="storyReaderTextArea"></div>'
            + '</div>'
            + '<div id="storyReaderBlackout"></div>'
            + '<div id="storyReaderCenterText"></div>'
            + '<div id="storyReaderBlackoutText"></div>'
            + '</div>'
            + '<button id="storyReaderCloseBtn">✕</button>'
            + '<button id="storyReaderPrevBtn">◀</button>'
            + '<div id="storyReaderDebugLine">' + STORY_ENGINE_BUILD + '</div>'
            + '<div id="storyTransitionWhiteout"></div>'
            + '</div>';
        document.body.appendChild(overlay);
        storyLibraryState.overlayEl = overlay;

        const booksWrap = overlay.querySelector('#storyBooksWrap');
        STORY_CHAPTERS.forEach(function(chapter) {
            chapter._spawnDelay = undefined;

            const wrapper = document.createElement('div');
            wrapper.className = 'story-book-wrapper';
            const inner = document.createElement('div');
            inner.className = 'story-book-inner';

            const front = document.createElement('div');
            front.className = 'story-book-front';
            front.style.backgroundImage = "url('" + chapter.frontImage + "')";

            // 読了済みの本の表紙に重ねる、薄暗いオーバーレイ＋eyes.gif（横幅いっぱい・縦センター）。
            const readOverlay = document.createElement('div');
            readOverlay.className = 'story-book-read-overlay';
            readOverlay.innerHTML = '<img src="story/eyes.gif" alt="">';
            front.appendChild(readOverlay);

            const back = document.createElement('div');
            back.className = 'story-book-back';
            back.style.backgroundImage = "url('" + chapter.backImage + "')";

            const lock = document.createElement('div');
            lock.className = 'story-book-lock';
            lock.style.display = chapter.locked ? '' : 'none';

            inner.appendChild(front);
            inner.appendChild(back);
            inner.appendChild(lock);
            inner.addEventListener('click', function() { onStoryBookClick(chapter); });
            wrapper.appendChild(inner);
            booksWrap.appendChild(wrapper);

            chapter._wrapperEl = wrapper;
            chapter._innerEl = inner;
            chapter._frontEl = front;
            chapter._backEl = back;
            chapter._lockEl = lock;
            chapter._readOverlayEl = readOverlay;
            updateStoryBookReadVisual(chapter);
        });

        // ===== 初回案内 or 通常表示の分岐 =====
        storyLibraryState.unlocked = isStoryLibraryUnlocked();
        storyLibraryState.mode = storyLibraryState.unlocked ? 'carousel' : 'intro_wait_tap';
        storyLibraryState.booksRevealed = storyLibraryState.unlocked;
        storyLibraryState.pendingUnlock = false;
        storyLibraryState.dialogueQueue = [];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = null;

        const perspective = overlay.querySelector('#storyLibraryPerspective');
        if (perspective) perspective.style.display = storyLibraryState.unlocked ? '' : 'none';

        const stage = overlay.querySelector('#storyLibraryStage');
        stage.addEventListener('pointerdown', onStoryDragStart);
        stage.addEventListener('pointermove', onStoryDragMove);
        stage.addEventListener('pointerup', onStoryDragEnd);
        stage.addEventListener('pointerleave', onStoryDragEnd);
        stage.addEventListener('click', onStoryStageClick);

        overlay.querySelector('#storyLibraryCloseBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            closeStoryLibrary();
        });
        overlay.querySelector('#storyMuteBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            onStoryMuteToggle();
        });
        overlay.querySelector('#storyBookDetailCloseBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            closeStoryBookDetail();
        });
        overlay.querySelector('#storyKakeraCounter').addEventListener('click', function(e) {
            e.stopPropagation();
            openKakeraAcquisitionList();
        });
        overlay.querySelector('#storyKakeraInfoCloseBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            closeKakeraAcquisitionList();
        });
        overlay.querySelector('#storyReaderCloseBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            if (storyLibraryState.readerCloseDisabled) return; // 演出上、離脱させたくない場面では無効
            endStoryReader();
        });
        overlay.querySelector('#storyReaderPrevBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            if (storyLibraryState.readerCloseDisabled) return;
            goToPrevReaderPage();
        });

        storyLibraryState.rotationY = 0;
        storyLibraryState.dragging = false;
        storyLibraryState.dragMoved = false;

        updateStoryLibraryScale();
        window.addEventListener('resize', updateStoryLibraryScale);
        window.addEventListener('orientationchange', updateStoryLibraryScale);

        updateStoryMuteIcon();
        updateKakeraDisplays();
        if (typeof playBattleBGM === 'function') {
            playBattleBGM(STORY_BGM_SRC);
        }

        storyLibraryState.rafId = requestAnimationFrame(storyLibraryTick);
    }

    // スマホ等で画面幅が基準幅(500px)より狭い場合、本棚全体（3D演出ごと）を
    // 画面幅にぴったり収まるよう縮小する。本の位置計算(radius等)は基準幅のまま行い、
    // 見た目だけをCSSのtransform:scaleでフィットさせるため、本の配置ロジックはシンプルなまま保てる。
    function updateStoryLibraryScale() {
        if (!storyLibraryState.overlayEl) return;
        const stage = storyLibraryState.overlayEl.querySelector('#storyLibraryStage');
        const perspective = storyLibraryState.overlayEl.querySelector('#storyLibraryPerspective');
        if (!stage || !perspective) return;
        const w = stage.clientWidth || STORY_STAGE_REF_WIDTH;
        const scale = Math.min(1, w / STORY_STAGE_REF_WIDTH);
        perspective.style.transform = 'scale(' + scale + ')';
        perspective.style.transformOrigin = '50% 56%';
    }

    // 本体（ゲーム画面）のミュート状態・toggleMute()をそのまま流用する（二重管理しない）。
    // アイコンだけ咖喱図書館内の専用ボタンにも反映させる。
    function onStoryMuteToggle() {
        if (typeof toggleMute === 'function') toggleMute();
        updateStoryMuteIcon();
    }
    function updateStoryMuteIcon() {
        if (!storyLibraryState.overlayEl) return;
        const icon = storyLibraryState.overlayEl.querySelector('#storyMuteIcon');
        if (!icon) return;
        const muted = (typeof isMuted !== 'undefined') && isMuted;
        icon.src = muted ? 'sound-off.svg' : 'sound-on.svg';
    }

    // 本棚画面／本の拡大画面、両方の「想いの欠片:N個」表示を更新する。
    // 本棚側は、オンボーディング（getKakeraOnboardStage）が始まる前（0）は非表示のまま。
    // 本の拡大画面側は、最初から常に表示する。
    function updateKakeraDisplays() {
        if (!storyLibraryState.overlayEl) return;
        const stage = getKakeraOnboardStage();
        const count = getStoryKakera();
        const label = '想いの欠片:' + count + '個';
        const shelfEl = storyLibraryState.overlayEl.querySelector('#storyKakeraCounter');
        if (shelfEl) {
            shelfEl.textContent = label;
            shelfEl.style.display = stage >= 1 ? 'block' : 'none';
        }
        const detailEl = storyLibraryState.overlayEl.querySelector('#storyBookDetailKakera');
        if (detailEl) {
            detailEl.textContent = label;
            detailEl.style.display = 'block';
        }
    }

    function storyLibraryTick(ts) {
        const t = ts / 1000;
        if (!storyLibraryState.dragging) {
            storyLibraryState.rotationY += STORY_AUTO_ROTATE_SPEED;
        }
        storyLibraryState.t = t;
        renderStoryBooks(t, ts);
        storyLibraryState.rafId = requestAnimationFrame(storyLibraryTick);
    }

    function renderStoryBooks(t, tsMs) {
        if (!storyLibraryState.overlayEl || !storyLibraryState.booksRevealed) return;
        const count = STORY_CHAPTERS.length;
        const radius = (150 + count * 8) * 0.85;
        const rotationY = storyLibraryState.rotationY;
        const booksWrap = storyLibraryState.overlayEl.querySelector('#storyBooksWrap');
        if (booksWrap) {
            booksWrap.style.transform = 'translateY(-144px) rotateX(6deg) rotateY(' + rotationY + 'deg)';
        }

        STORY_CHAPTERS.forEach(function(chapter, i) {
            const angle = (360 / count) * i;
            const bob = Math.sin(t * 1.1 + i * 1.7) * STORY_FLOAT_INTENSITY;
            const wobble = Math.sin(t * 0.7 + i * 2.3) * 2.5;
            const breathe = 1 + Math.sin(t * 0.9 + i) * 0.015;

            // 「はい」を選んだ直後、本が上から降ってくるように1冊ずつ時間差で出現する演出。
            let spawnProgress = 1;
            if (typeof chapter._spawnDelay === 'number') {
                const elapsed = tsMs - storyLibraryState.revealStartTs - chapter._spawnDelay;
                spawnProgress = Math.max(0, Math.min(1, elapsed / STORY_BOOK_SPAWN_DURATION_MS));
            }
            const eased = 1 - Math.pow(1 - spawnProgress, 3);
            const dropOffset = (1 - eased) * 160;
            const spawnScale = 0.4 + eased * 0.6;

            chapter._wrapperEl.style.transform = 'rotateY(' + angle + 'deg) translateZ(' + radius + 'px)';
            chapter._innerEl.style.opacity = String(eased);
            chapter._innerEl.style.transform =
                'translate(-50%,-60%) translateY(' + (bob - dropOffset) + 'px) rotateZ(' + wobble + 'deg) scale(' + (breathe * spawnScale) + ')';

            const normalizedAngle = ((angle + rotationY) % 360 + 360) % 360;
            const diff = normalizedAngle > 180 ? 360 - normalizedAngle : normalizedAngle;
            const showBack = diff > 90;
            chapter._frontEl.style.opacity = showBack ? '0' : '1';
            chapter._backEl.style.opacity = showBack ? '1' : '0';
        });
    }

    function onStoryDragStart(e) {
        if (storyLibraryState.mode !== 'carousel') return;
        storyLibraryState.dragging = true;
        storyLibraryState.dragMoved = false;
        storyLibraryState.startX = e.clientX;
        storyLibraryState.startRot = storyLibraryState.rotationY;
        const stage = storyLibraryState.overlayEl.querySelector('#storyLibraryStage');
        if (stage) stage.style.cursor = 'grabbing';
    }
    function onStoryDragMove(e) {
        if (storyLibraryState.mode !== 'carousel') return;
        if (!storyLibraryState.dragging) return;
        const delta = e.clientX - storyLibraryState.startX;
        if (Math.abs(delta) > 5) storyLibraryState.dragMoved = true;
        storyLibraryState.rotationY = storyLibraryState.startRot + delta * 0.35;
    }
    function onStoryDragEnd() {
        if (!storyLibraryState.dragging) return;
        storyLibraryState.dragging = false;
        if (storyLibraryState.overlayEl) {
            const stage = storyLibraryState.overlayEl.querySelector('#storyLibraryStage');
            if (stage) stage.style.cursor = 'grab';
        }
    }

    function onStoryBookClick(chapter) {
        if (storyLibraryState.mode !== 'carousel') return;
        if (storyLibraryState.dragMoved) return;
        openStoryBookDetail(chapter);
    }

    function openStoryBookDetail(chapter) {
        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        const card = storyLibraryState.overlayEl.querySelector('#storyBookDetailCard');
        const libraryCloseBtn = storyLibraryState.overlayEl.querySelector('#storyLibraryCloseBtn');
        storyLibraryState.currentDetailChapter = chapter;
        card.className = 'story-book-detail-cover';
        card.style.backgroundImage = "url('" + chapter.frontImage + "')";
        card.innerHTML = '';
        if (chapter.locked) {
            const lock = document.createElement('div');
            lock.className = 'story-book-detail-lock';
            card.appendChild(lock);
        }
        // 読了オーバーレイ（eyes.gif）はupdateStoryBookDetailActionButton内のupdateStoryBookDetailReadOverlayで反映する
        detailOverlay.style.display = 'flex';
        // 咖喱図書館から出る×（左上）と本棚に戻る×が同時に出て紛らわしくならないよう、
        // 本の表紙表示中は咖喱図書館から出る×を隠す（本棚に戻る×が同じ位置に表示される）。
        if (libraryCloseBtn) libraryCloseBtn.style.display = 'none';

        updateKakeraDisplays();
        updateStoryBookDetailActionButton(chapter);
        maybeStartKakeraBookIntro();
        maybeStartBookBossIntro(chapter);
    }
    // 初回の本の拡大画面チュートリアル中は、「いったん左上の×を押して戻ってくるのだ」の
    // セリフに辿り着くまで×を無効にする。
    function isBookIntroCloseBlocked() {
        if (getKakeraOnboardStage() !== 0) return false;
        const page = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        return !(page && page.unlocksClose);
    }

    // 本棚画面での「上に「想いの欠片」と表示されてるだろ それをタップしてみな」の間は、
    // 咖喱図書館から出る×を無効にする。必ず想いの欠片カウンターをタップして進めさせるため。
    function isLibraryCloseBlocked() {
        if (getKakeraOnboardStage() !== 1) return false;
        const page = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        return !!(storyLibraryState.mode === 'intro_dialogue' && page && page.waitForExternalTrigger);
    }

    function closeStoryBookDetail() {
        if (isBookIntroCloseBlocked()) return; // まだ×を押せるセリフに辿り着いていない
        if (storyLibraryState.bookBossIntroActive) return; // 初回の「戦う」案内セリフの間は×を無効化

        // 「×を押して戻ってくるのだ」のセリフがまだ表示されたままなら、×を押した時点で
        // タップして消したのと同じ扱いにしてから閉じる（そのまま「上に〜」の会話に繋げる）。
        const page = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        if (storyLibraryState.mode === 'intro_dialogue' && page && page.unlocksClose) {
            endDialogueSequence();
        }

        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        const libraryCloseBtn = storyLibraryState.overlayEl.querySelector('#storyLibraryCloseBtn');
        if (detailOverlay) detailOverlay.style.display = 'none';
        if (libraryCloseBtn) libraryCloseBtn.style.display = 'flex';

        maybeStartKakeraShelfIntro();
    }

    // ===== 想いの欠片：初回チュートリアル一式 =====

    // 初めて本の拡大画面に入った時の館長のセリフ（1回だけ）。
    // まずは表紙の拡大画像だけを2秒ほど見せてからセリフを開始する。本の拡大画面では館長の画像は出さない。
    function maybeStartKakeraBookIntro() {
        if (getKakeraOnboardStage() !== 0) return;
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueStarting = true;
        storyLibraryState.dialogueQueue = [
            { text: '「人のカレーの想いを知るには\n自らのカレーの想いも必要だ」' },
            { text: '「まずはカレーの想いの欠片を集めてくるんだ\n想いの欠片が本を解放する」' },
            { text: '「いったん左上の「×」を押して\n戻ってくるのだ」', unlocksClose: true },
        ];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            setKakeraOnboardStage(1);
            storyLibraryState.mode = 'carousel';
            updateKakeraDisplays();
        };
        setTimeout(function() {
            showStoryDialogueLayerOnly();
            scheduleDialogueStart(300);
        }, 2000);
    }

    // 初めてどれか1冊を読み終え、「戦う」ボタン（本のボス戦）とeyes.gifが使えるようになった瞬間に
    // 一度だけ挟む館長のセリフ（画像は出さない）。book1〜8のどれから読むかはプレイヤー次第なので、
    // 本の番号は問わず「読了済み・ボス未撃破」の状態を初めて見せた時に発動する（2冊目以降は出ない）。
    // セリフの間は×（本棚に戻る）・戦うボタンを両方とも無効化し、終わったら元に戻す。
    function maybeStartBookBossIntro(chapter) {
        if (!chapter || hasSeenBookBossIntro()) return;
        if (storyLibraryState.mode === 'intro_dialogue') return; // 他の会話（想いの欠片チュートリアル等）と衝突させない
        const hasBoss = (typeof STORY_BOOK_BOSSES !== 'undefined') && STORY_BOOK_BOSSES[chapter.num];
        if (chapter.locked || !hasBoss || !hasStoryChapterBeenRead(chapter.num) || hasStoryChapterBeenCleared(chapter.num)) return;

        setBookBossIntroSeen(true);
        storyLibraryState.bookBossIntroActive = true;
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueQueue = [
            { text: '「想いを一つ読み終えたなら\n最後の仕上げだ」' },
            { text: '「想いの暴走を防ぐために\n想いの書を倒すのだ」' },
            { text: '「想いの書との戦いでは\nカレーの力が尽きた場合でも」' },
            { text: '「ストックから次のカレーを\n出撃させることができる」' },
            { text: '「準備を整えてから挑戦するんだ」' },
        ];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            storyLibraryState.bookBossIntroActive = false;
            storyLibraryState.mode = 'carousel';
        };
        showStoryDialogueLayerOnly();
        scheduleDialogueStart(300);
    }

    // 本の拡大画面から本棚に戻った直後（ステージ1の時だけ）の館長のセリフ。
    // このセリフはタップでは消えず、「想いの欠片」をタップした時にopenKakeraAcquisitionList()側で閉じる。
    function maybeStartKakeraShelfIntro() {
        if (getKakeraOnboardStage() !== 1) return;
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueQueue = [
            { text: '「上に「想いの欠片」と表示されてるだろ\nそれをタップしてみな」', waitForExternalTrigger: true },
        ];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            setKakeraOnboardStage(2);
            storyLibraryState.mode = 'carousel';
        };
        showStoryLibraryman();
        scheduleDialogueStart(500);
    }

    // 想いの欠片の入手方法一覧を閉じた直後（ステージ2の時だけ）の締めのセリフ＋30個プレゼント。
    function maybeStartKakeraFinalGift() {
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueQueue = [
            { text: '「想いの欠片を30個\n特別にプレゼントしてあげよう」' },
            { text: '「足りない分は自分で集めるんだ。\n想いの欠片は100個までしか持てないから\n貯め込みすぎないようにな」' },
        ];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            setKakeraOnboardStage(4);
            storyLibraryState.mode = 'carousel';
            addStoryKakeraWithNotice(30);
        };
        showStoryLibraryman();
        scheduleDialogueStart(500);
    }

    function buildKakeraInfoHtml() {
        let html = '<h3>想いの欠片の入手方法</h3>';
        STORY_KAKERA_SOURCES.forEach(function(row) {
            html += '<div class="story-kakera-row"><span>' + row[0] + '</span><span>' + row[1] + '</span></div>';
        });
        return html;
    }

    function openKakeraAcquisitionList() {
        // 「それをタップしてみな」のセリフがまだ表示されたままなら、ここで片付けてから一覧を開く。
        const currentPage = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        if (storyLibraryState.mode === 'intro_dialogue' && currentPage && currentPage.waitForExternalTrigger) {
            endDialogueSequence();
        }
        // まず一覧そのものを表示し、初めての場合はその前面に館長の一言を重ねて表示する。
        showKakeraAcquisitionListOverlay();
        if (!hasSeenKakeraInfoIntro()) {
            setKakeraInfoIntroSeen(true);
            playKakeraInfoIntroLine();
        }
    }

    // 初めて想いの欠片の入手方法一覧を開いた直後、一覧を表示したままその前面に重ねる館長の一言
    // （館長の画像は不要。会話レイヤーのz-indexを一覧より高くしてあるので、一覧の上に重なって見える）。
    function playKakeraInfoIntroLine() {
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueQueue = [
            { text: '「カレーに関する様々な方法で\n想いの欠片は入手可能だ」' },
        ];
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            storyLibraryState.mode = 'carousel';
        };
        showStoryDialogueLayerOnly();
        scheduleDialogueStart(200);
    }

    function showKakeraAcquisitionListOverlay() {
        const overlay = storyLibraryState.overlayEl.querySelector('#storyKakeraInfoOverlay');
        const card = storyLibraryState.overlayEl.querySelector('#storyKakeraInfoCard');
        const libraryCloseBtn = storyLibraryState.overlayEl.querySelector('#storyLibraryCloseBtn');
        card.innerHTML = buildKakeraInfoHtml();
        overlay.style.display = 'flex';
        if (libraryCloseBtn) libraryCloseBtn.style.display = 'none';
    }
    function closeKakeraAcquisitionList() {
        const overlay = storyLibraryState.overlayEl.querySelector('#storyKakeraInfoOverlay');
        const libraryCloseBtn = storyLibraryState.overlayEl.querySelector('#storyLibraryCloseBtn');
        if (overlay) overlay.style.display = 'none';
        if (libraryCloseBtn) libraryCloseBtn.style.display = 'flex';

        if (getKakeraOnboardStage() === 2) {
            setKakeraOnboardStage(3);
            maybeStartKakeraFinalGift();
        }
    }

    // ===== 本の解放／読む =====

    // 読了オーバーレイ（薄暗い＋eyes.gif）を表示すべきか：読了済み・かつ、まだそのボスを
    // 撃破していない間だけ。ボスを撃破した後は、勝利の証として通常の表紙に戻す。
    function shouldShowStoryBookReadOverlay(chapter) {
        return !chapter.locked && hasStoryChapterBeenRead(chapter.num) && !hasStoryChapterBeenCleared(chapter.num);
    }

    // 本棚（3D表紙）側の読了オーバーレイ（薄暗い＋eyes.gif）の表示切替。
    function updateStoryBookReadVisual(chapter) {
        if (!chapter._readOverlayEl) return;
        chapter._readOverlayEl.style.display = shouldShowStoryBookReadOverlay(chapter) ? 'block' : 'none';
    }

    // 拡大表紙画面（#storyBookDetailCard）側の読了オーバーレイの表示切替。
    // 拡大画面を開いた瞬間だけでなく、本編読了直後・ボス撃破直後など、拡大画面が既に開いた
    // ままの状態でも呼べるように、画面を開き直さなくても反映できる専用関数にしてある。
    function updateStoryBookDetailReadOverlay(chapter) {
        const card = storyLibraryState.overlayEl.querySelector('#storyBookDetailCard');
        if (!card) return;
        let overlay = card.querySelector('.story-book-read-overlay');
        const shouldShow = shouldShowStoryBookReadOverlay(chapter);
        if (shouldShow) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'story-book-read-overlay';
                overlay.innerHTML = '<img src="story/eyes.gif" alt="">';
                card.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        } else if (overlay) {
            overlay.style.display = 'none';
        }
    }

    function updateStoryBookDetailActionButton(chapter) {
        updateStoryBookDetailReadOverlay(chapter);
        const btn = storyLibraryState.overlayEl.querySelector('#storyBookDetailActionBtn');
        if (!btn) return;
        btn.onclick = null;
        btn.classList.remove('story-book-action-disabled');
        const hasBoss = (typeof STORY_BOOK_BOSSES !== 'undefined') && STORY_BOOK_BOSSES[chapter.num];
        if (!chapter.locked && hasBoss && hasStoryChapterBeenRead(chapter.num) && hasStoryChapterBeenCleared(chapter.num)) {
            // 読了済み・ボスも撃破済み：再読
            btn.textContent = '再読';
            btn.style.display = 'inline-block';
            btn.onclick = function(e) { e.stopPropagation(); onStoryBookReadClick(chapter); };
        } else if (!chapter.locked && hasBoss && hasStoryChapterBeenRead(chapter.num)) {
            // 読了済み・ボス未撃破：戦う
            btn.textContent = '戦う';
            btn.style.display = 'inline-block';
            btn.onclick = function(e) { e.stopPropagation(); startBookBossBattle(chapter); };
        } else if (!chapter.locked) {
            btn.textContent = '読む';
            btn.style.display = 'inline-block';
            btn.onclick = function(e) { e.stopPropagation(); onStoryBookReadClick(chapter); };
        } else if (typeof chapter.unlockCost === 'number') {
            btn.textContent = '解放';
            btn.style.display = 'inline-block';
            btn.onclick = function(e) { e.stopPropagation(); onStoryBookUnlockClick(chapter); };
        } else {
            // book-09/10など、解放条件が未設定の巻
            btn.textContent = '解放条件は後日公開';
            btn.style.display = 'inline-block';
            btn.classList.add('story-book-action-disabled');
        }

        // 再戦ボタン：ボスを一度でも撃破していれば「再読」の横に並べて表示し、
        // 何度でも同じボスと戦えるようにする（読了済みは撃破済みなら必ずtrueなので改めて見ない）。
        const rebattleBtn = storyLibraryState.overlayEl.querySelector('#storyBookDetailRebattleBtn');
        if (rebattleBtn) {
            if (!chapter.locked && hasBoss && hasStoryChapterBeenCleared(chapter.num)) {
                rebattleBtn.style.display = 'inline-block';
                rebattleBtn.onclick = function(e) { e.stopPropagation(); startBookBossBattle(chapter, true); };
            } else {
                rebattleBtn.style.display = 'none';
                rebattleBtn.onclick = null;
            }
        }
    }

    function onStoryBookUnlockClick(chapter) {
        if (!chapter.locked || typeof chapter.unlockCost !== 'number') return;
        const cost = chapter.unlockCost;
        if (getStoryKakera() < cost) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('想いの欠片が足りません', 'この本を解放するには想いの欠片が' + cost + '個必要です。');
            }
            return;
        }
        const doUnlock = function() {
            setStoryKakera(getStoryKakera() - cost);
            unlockStoryChapter(chapter);
        };
        const msg = '想いの欠片を' + cost + '個消費してこの本を解放します。よろしいですか？';
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('本を解放する', msg, doUnlock);
        } else if (confirm(msg)) {
            doUnlock();
        }
    }

    function unlockStoryChapter(chapter) {
        chapter.locked = false;
        markChapterUnlockedPersisted(chapter.num);

        // 本棚側の鍵アイコンは即座に消す
        if (chapter._lockEl) chapter._lockEl.style.display = 'none';

        // 拡大画面側の鍵は光ってから消える演出
        const detailLock = storyLibraryState.overlayEl.querySelector('.story-book-detail-lock');
        if (detailLock) {
            detailLock.classList.add('story-book-lock-unlocking');
            setTimeout(function() {
                if (detailLock.parentNode) detailLock.parentNode.removeChild(detailLock);
            }, 700);
        }
        if (typeof playSoundEffect === 'function') {
            playSoundEffect('healing.mp3');
        }
        updateStoryBookDetailActionButton(chapter);
    }

    function onStoryBookReadClick(chapter) {
        startStoryReader(chapter);
    }

    // ===== 本のボス戦 =====
    // 「PCと対戦」の戦闘エンジン（launchVsCutIn→confirmVsDeploy→startBattleScene→done）を
    // そのまま流用する。oppCurryDataにisBookBoss:trueを立てておくと、game.js側
    // （startBattleScene/step/done、gameのコピーN.js側の対応する分岐）が背景・敵アイコン・
    // カレー名・BGM・報酬を本のボス戦専用の見た目に切り替える。ここではその起動と後片付け、
    // および咖喱図書館の背景より前面に見せるためのz-index持ち上げだけを担当する。

    function startBookBossBattle(chapter, isRebattle) {
        if (storyLibraryState.bookBossIntroActive) return; // 初回の「戦う」案内セリフの間は戦うボタンを無効化
        const boss = (typeof STORY_BOOK_BOSSES !== 'undefined') ? STORY_BOOK_BOSSES[chapter.num] : null;
        if (!boss) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('準備中', 'この本のボス戦はまだ準備中だ。');
            }
            return;
        }
        if (typeof hasUsableCurryForBattle === 'function' && !hasUsableCurryForBattle()) {
            if (typeof alertNoUsableCurry === 'function') alertNoUsableCurry();
            return;
        }
        try { if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}

        // isBotMatch/currentRoomIdはgame.js側でlet宣言されたグローバル変数（windowプロパティにはならない）。
        // 同一ドキュメント内の別scriptタグからでも、識別子を直接代入すれば同じ変数を書き換えられるため、
        // window.をつけず直接代入する（window経由だと別物のプロパティを作るだけで実際の変数は変わらない）。
        isBotMatch = true;
        currentRoomId = null;

        const oppCurryData = {
            name: boss.curryName,
            visual: boss.image,
            materials: boss.materials,
            spice: '',
            hp: boss.hp, atk: boss.atk, def: boss.def, spd: boss.spd,
            foodCategory: boss.foodCategory || null, // 属性（meat/seafood/vegetable/fruit）。ふわとろオム等の軽減判定に使用。
            isHomerun: !!boss.isHomerun, // 特技「ホームラン」：プレイヤーの技を確率で打ち返して無効化（既存のisHomerun反射ロジックをそのまま流用）
            isWanpaku: !!boss.isWanpaku, // 特技「わんぱく」：通常攻撃のダメージ幅が広がり、ミスすることもある（既存のisWanpakuロジックをそのまま流用）
            isBotImage: true,
            isBookBoss: true,
            bookChapterNum: chapter.num,
            isBookBossRebattle: !!isRebattle, // 再戦（撃破後の周回）かどうか。勝利報酬に想いの欠片+10個を追加する目印。
        };

        storyLibraryState.inBookBossBattle = true;
        storyLibraryState.bookBossChapter = chapter;
        applyBookBattleLift(true);
        prepareBookBossResultButton();

        if (typeof launchVsCutIn === 'function') {
            launchVsCutIn(boss.name, boss.image, oppCurryData);
        }
    }

    // #vsCutIn・#battleArenaを咖喱図書館の背景（z-index:9999）より前面に持ち上げる／元に戻す。
    // 通常ヘッダーの#muteBtnもこの間は隠れてしまうため、専用のミュートボタン(#bookBattleMuteBtn)を
    // 同じタイミングで表示/非表示にする。
    function applyBookBattleLift(on) {
        const vs = document.getElementById('vsCutIn');
        const arena = document.getElementById('battleArena');
        const muteBtn = document.getElementById('bookBattleMuteBtn');
        if (vs) vs.classList.toggle('book-battle-lift', !!on);
        if (arena) arena.classList.toggle('book-battle-lift', !!on);
        if (muteBtn) {
            muteBtn.style.display = on ? 'flex' : 'none';
            if (on) updateBookBattleMuteIcon();
        }
    }

    // 本のボス戦専用ミュートボタン：本体（ゲーム画面）のミュート状態・toggleMute()をそのまま流用する
    // （onStoryMuteToggle/updateStoryMuteIconと同じ考え方。二重管理はしない、アイコンだけ同期する）。
    // #bookBattleMuteBtnはgame.html側の静的なinline onclickからwindow.onBookBattleMuteToggleを直接呼ぶため、
    // （story.jsのIIFE内のただのfunction宣言はwindow直下に出ないので）明示的にwindowへ公開しておく。
    window.onBookBattleMuteToggle = function() {
        if (typeof toggleMute === 'function') toggleMute();
        updateBookBattleMuteIcon();
    };
    function updateBookBattleMuteIcon() {
        const icon = document.getElementById('bookBattleMuteIcon');
        if (!icon) return;
        const muted = (typeof isMuted !== 'undefined') && isMuted;
        icon.src = muted ? 'sound-off.svg' : 'sound-on.svg';
    }

    // バトル結果画面の「対戦タブに戻る」ボタンを、本編中に戻れる「戻る」に一時的に差し替える。
    function prepareBookBossResultButton() {
        const resultBox = document.getElementById('battleResultBox');
        if (!resultBox) return;
        const backBtn = resultBox.querySelector('button.btn.btn-start');
        if (!backBtn) return;
        if (backBtn.dataset.bookBossOrigText === undefined) {
            backBtn.dataset.bookBossOrigText = backBtn.textContent;
        }
        backBtn.textContent = '戻る';
        backBtn.onclick = function() { endBookBossBattle(); };
    }

    // バトル結果画面のボタンを通常仕様（「対戦タブに戻る」＝endBattleScene）に戻す。
    function restoreNormalResultButton() {
        const resultBox = document.getElementById('battleResultBox');
        if (!resultBox) return;
        const backBtn = resultBox.querySelector('button.btn.btn-start');
        if (!backBtn) return;
        backBtn.textContent = (backBtn.dataset.bookBossOrigText !== undefined) ? backBtn.dataset.bookBossOrigText : '対戦タブに戻る';
        backBtn.onclick = function() { if (typeof endBattleScene === 'function') endBattleScene(); };
    }

    // 本のボス戦の終了処理（結果画面の「戻る」ボタンから呼ばれる）。咖喱図書館の本の拡大画面へ戻す。
    function endBookBossBattle() {
        const overlay = document.getElementById('battleResultOverlay');
        const arena = document.getElementById('battleArena');
        if (overlay) overlay.style.display = 'none';
        if (arena) arena.classList.remove('book-boss-mode');
        restoreNormalResultButton();

        // battleSetup/lobbyArea/waitingAreaの表示状態を含め、対戦タブ側を通常のPC戦終了時と
        // 同じ状態に戻す。ここを自前でやらず既存のendBattleScene()に任せることで、対戦タブを
        // 開いた時に中身が空になってしまう不具合を防ぐ（内部でstopBattleBGM・endEventMode・
        // battleResultBox/battleArenaの非表示・showBattleGuideChar等もまとめて行われる）。
        try { if (typeof endBattleScene === 'function') endBattleScene(); } catch (e) {}

        applyBookBattleLift(false);
        storyLibraryState.inBookBossBattle = false;

        // 咖喱図書館のBGMを再開する
        if (typeof playBattleBGM === 'function') playBattleBGM(STORY_BGM_SRC);

        // 本の拡大画面のボタン状態（クリア済みなら「再読」に）を更新
        const chapter = storyLibraryState.bookBossChapter || storyLibraryState.currentDetailChapter;
        if (chapter) updateStoryBookDetailActionButton(chapter);
        storyLibraryState.bookBossChapter = null;
    }

    // game.js側のdone()／abortMatchDeployment()を後からラップして、本のボス戦専用のフック・
    // 後片付けを差し込む（installStoryKakeraHooksと同じmonkey patch方式。game.js自体は無編集）。
    function installBookBossHooks() {
        if (window.__storyBookBossHooksInstalled) return;
        window.__storyBookBossHooksInstalled = true;

        // game.js側のdone()から、本のボスを撃破した瞬間に呼ばれるフック。
        // クリア状態の記録、表紙オーバーレイ（撃破済みなら消す）・拡大画面ボタンの見た目更新、
        // 再戦（isRebattle）の場合は想いの欠片+10個の付与を行う（テキスト表示自体はgame.js側の
        // rewardTextに既に「想いの欠片+10個」が含まれている想定＝実際の加算だけをここで行う）。
        window.onBookBossWin = function(chapterNum, isRebattle) {
            if (typeof chapterNum !== 'number') return;
            markStoryChapterCleared(chapterNum);
            if (isRebattle) addStoryKakera(10);
            const chapter = STORY_CHAPTERS.find(function(c) { return c.num === chapterNum; });
            if (!chapter) return;
            updateStoryBookReadVisual(chapter);
            if (storyLibraryState.currentDetailChapter === chapter) {
                updateStoryBookDetailActionButton(chapter);
            }
        };

        // vsカットイン画面で「撤退（キャンセル）」を押した場合も、持ち上げたz-indexとボタンを元に戻す。
        wrapGlobalFn('abortMatchDeployment', function(orig) {
            return function() {
                const r = orig.apply(this, arguments);
                if (storyLibraryState.inBookBossBattle) {
                    restoreNormalResultButton();
                    applyBookBattleLift(false);
                    storyLibraryState.inBookBossBattle = false;
                    storyLibraryState.bookBossChapter = null;
                }
                return r;
            };
        });
    }

    // ===== 環境音（雨音など）専用のオーディオチャンネル =====
    // playBattleBGM/stopBattleBGM（本体の単一BGMチャンネル）とは別に、雨音などを
    // BGMに重ねてループ再生するための、本編専用の音声レイヤー。ミュート設定は本体と共通で尊重する。
    function playStoryAmbient(src) {
        if (typeof isMuted !== 'undefined' && isMuted) return;
        if (storyLibraryState.ambientAudio && storyLibraryState.ambientAudio._src === src) return; // 再生中
        stopStoryAmbient();
        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = 0.35;
        audio._src = src;
        audio.play().catch(function() {});
        storyLibraryState.ambientAudio = audio;
    }
    function stopStoryAmbient() {
        if (storyLibraryState.ambientAudio) {
            storyLibraryState.ambientAudio.pause();
            storyLibraryState.ambientAudio.currentTime = 0;
            storyLibraryState.ambientAudio = null;
        }
    }

    // ===== 本編の効果音（SE）専用チャンネル =====
    // 本体（game.js）のplaySoundEffectは内部の使い回しAudioプールを直接掴めないため、
    // 「×で閉じた時に鳴りっぱなしの効果音を確実に止める」ことができない。
    // そのため本編（開く／ページめくり／beatごとのse）用の効果音だけは、ここで自前のAudio要素を
    // 作って再生し、参照を保持しておく（再生し終わったものは自動的にリストから外す）。
    function playStorySE(src) {
        if (!src) return;
        if (typeof isMuted !== 'undefined' && isMuted) return;
        try {
            const audio = new Audio(src);
            audio.volume = 0.7;
            const list = storyLibraryState.activeSeAudios;
            list.push(audio);
            audio.addEventListener('ended', function() {
                const i = list.indexOf(audio);
                if (i !== -1) list.splice(i, 1);
            });
            audio.play().catch(function() {});
        } catch (e) {}
    }
    // 再生中の本編効果音をすべて止める（BGM／環境音は対象外。呼び出し側で個別に止める）。
    function stopAllStorySE() {
        storyLibraryState.activeSeAudios.forEach(function(a) {
            try { a.pause(); a.currentTime = 0; } catch (e) {}
        });
        storyLibraryState.activeSeAudios = [];
    }

    // ===== 本編（各巻ストーリー）再生エンジン（絵本風ページ送り方式） =====
    // 内容データ（STORY_BOOK_SCRIPTS）はstory-scripts.js側で定義する。
    // ここではエンジン（ページ・文章の送り方）だけを扱い、各巻の文章・絵には一切関知しない。
    //
    // データ構造・コマンドの種類は story-scripts-work.js の冒頭コメントを参照。
    // 1冊 = ページの配列。1ページ = 背景/挿絵1枚 + 文章（beats）の配列。
    // beatsは「挿絵下のテキストエリアに即時表示する文章（text）」と
    // 「既存のメッセージウインドウ（タイプライター＋効果音）で表示するセリフ（say/narration）」を
    // 自由に混在できる。タップで次のbeatへ、ページの最後のbeatまで表示し終えたら次のページへめくる。
    // 前のページへは画面左端の戻るボタン（常設）で戻る。

    // 「読む」タップ時、効果音→表紙が光る→ホワイトアウトで本編画面に切り替える。
    function startStoryReader(chapter) {
        if (!chapter || chapter.locked) return;
        const pages = (typeof STORY_BOOK_SCRIPTS !== 'undefined') ? STORY_BOOK_SCRIPTS[chapter.num] : null;
        if (!pages || !pages.length) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('準備中', 'このストーリーはまだ準備中です。');
            }
            return;
        }

        playStorySE('story/open_book.mp3');

        const card = storyLibraryState.overlayEl.querySelector('#storyBookDetailCard');
        if (card) card.classList.add('story-book-opening-glow');
        const whiteout = storyLibraryState.overlayEl.querySelector('#storyTransitionWhiteout');

        // 光る演出を少し見せてからホワイトアウトを始める
        setTimeout(function() {
            if (whiteout) whiteout.style.opacity = '1';
            // ホワイトアウトで画面が覆われたタイミングで裏側の画面を切り替える
            setTimeout(function() {
                if (card) card.classList.remove('story-book-opening-glow');
                enterStoryReaderScreen(chapter, pages);
                if (whiteout) {
                    requestAnimationFrame(function() {
                        whiteout.style.opacity = '0';
                    });
                }
            }, 260);
        }, 220);
    }

    // ホワイトアウトの裏で行う、実際の画面切り替え（表紙拡大画面→本編読書画面）
    function enterStoryReaderScreen(chapter, pages) {
        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        const detailCloseBtn = storyLibraryState.overlayEl.querySelector('#storyBookDetailCloseBtn');
        const readerOverlay = storyLibraryState.overlayEl.querySelector('#storyReaderOverlay');
        const readerCloseBtn = storyLibraryState.overlayEl.querySelector('#storyReaderCloseBtn');
        // 本棚側の想いの欠片バッジ（z-indexの都合上、本編の上に見えてしまうため）は
        // 本編を読んでいる間は非表示にする。
        const shelfKakera = storyLibraryState.overlayEl.querySelector('#storyKakeraCounter');

        if (detailOverlay) detailOverlay.style.display = 'none';
        if (detailCloseBtn) detailCloseBtn.style.display = 'none';
        if (readerOverlay) readerOverlay.style.display = 'block';
        if (readerCloseBtn) readerCloseBtn.style.display = 'flex';
        if (shelfKakera) shelfKakera.style.display = 'none';

        storyLibraryState.mode = 'reader';
        storyLibraryState.readerPages = pages;
        storyLibraryState.readerChapter = chapter;
        storyLibraryState.readerBgmSrc = null;
        storyLibraryState.readerBusy = false;
        storyLibraryState.readerCloseDisabled = false;
        stopStoryAmbient(); // 前回の読書セッションの環境音が万一残っていないよう、念のためリセット

        showReaderPage(0);
    }

    // スケジュールしたタイマーが発火する頃には、既にページ／beatが切り替わっている場合がある
    // （× で本編を閉じた、戻るボタンで別のページに移動した等）ため、実行前に現在地と一致するか確認する。
    // expectedBeatIndexにnullを渡すと、ページが一致していればbeatの位置は問わない
    // （ページ開始直後の「1秒待つ」演出のように、まだ特定のbeatに紐付いていない場合に使う）。
    function scheduleReaderStep(delayMs, expectedPageIndex, expectedBeatIndex, cb) {
        setTimeout(function() {
            if (storyLibraryState.mode !== 'reader') return;
            if (storyLibraryState.readerPageIndex !== expectedPageIndex) return;
            if (expectedBeatIndex !== null && storyLibraryState.readerBeatIndex !== expectedBeatIndex) return;
            cb();
        }, delayMs);
    }

    // シルエット画像を切り替える際、位置・大きさ・画像が同時に切り替わって見えるよう、
    // 新しい画像の読み込みが完了してからまとめて反映する。
    // （先にleft/top/height/width等のスタイルだけ反映してからsrcを差し替えると、ブラウザが新しい
    // 画像を読み込み終えるまでの間、古い画像が新しいサイズ・位置に引き伸ばされて一瞬見えてしまう。
    // そこで、非表示のImage()で先読みしてから、読み込み完了後に画像・位置・大きさをまとめて
    // 一度に適用する。読み込みが遅い／失敗した場合の保険として、一定時間で強制的に反映する。）
    function applySilhouetteWhenReady(silEl, sil) {
        let done = false;
        const finish = function() {
            if (done) return;
            done = true;
            silEl.src = sil.src;
            silEl.style.left = sil.x || '50%';
            silEl.style.top = sil.y || '50%';
            // height指定があればheight基準、無ければwidth基準（どちらか一方のみ指定し、
            // もう片方はautoにしてアスペクト比を保つ）
            if (sil.height) { silEl.style.height = sil.height; silEl.style.width = 'auto'; }
            else { silEl.style.width = sil.width || '70%'; silEl.style.height = 'auto'; }
            const scale = sil.scale;
            silEl.style.transform = 'translate(-50%,-50%)' + (scale ? ' scale(' + scale + ')' : '');
            silEl.style.opacity = (typeof sil.opacity === 'number') ? sil.opacity : 1;
            silEl.style.display = 'block';
        };
        const preloadImg = new Image();
        preloadImg.onload = finish;
        preloadImg.onerror = finish;
        preloadImg.src = sil.src;
        setTimeout(finish, 400); // 読み込みが極端に遅い場合でも、待たせすぎないための保険
    }

    // ページ／beat共通：image（挿絵の差し替え）／overlay（黒オーバーレイの表示切替）／
    // silhouette（キャラクターシルエットの表示・位置・大きさ・不透明度）／bgm（メインBGMの切替・停止）／
    // ambient（雨音などの環境音レイヤーの切替・停止）／se（効果音を1回再生）を、指定されているものだけ反映する。
    // キー自体が無ければ「前の状態を維持（何もしない）」、値がnull/falseなら「明示的に消す・止める」という扱い。
    function applyReaderStageEffects(src) {
        if (!src || !storyLibraryState.overlayEl) return;

        if (Object.prototype.hasOwnProperty.call(src, 'image')) {
            const imgWrap = storyLibraryState.overlayEl.querySelector('#storyReaderImageWrap');
            const imgEl = storyLibraryState.overlayEl.querySelector('#storyReaderImage');
            if (imgWrap && imgEl) {
                if (src.image) { imgEl.src = src.image; imgWrap.style.display = 'block'; }
                else { imgWrap.style.display = 'none'; imgEl.removeAttribute('src'); }
            }
        }

        if (Object.prototype.hasOwnProperty.call(src, 'overlay')) {
            const overlayEl = storyLibraryState.overlayEl.querySelector('#storyReaderImageOverlay');
            if (overlayEl) overlayEl.style.display = src.overlay ? 'block' : 'none';
        }

        if (Object.prototype.hasOwnProperty.call(src, 'silhouette')) {
            const silEl = storyLibraryState.overlayEl.querySelector('#storyReaderSilhouette');
            if (silEl) {
                const sil = src.silhouette;
                if (sil && sil.src) {
                    applySilhouetteWhenReady(silEl, sil);
                } else {
                    silEl.style.display = 'none';
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(src, 'bgm')) {
            if (src.bgm) {
                if (src.bgm !== storyLibraryState.readerBgmSrc) {
                    storyLibraryState.readerBgmSrc = src.bgm;
                    if (typeof playBattleBGM === 'function') playBattleBGM(src.bgm);
                }
            } else {
                storyLibraryState.readerBgmSrc = null;
                if (typeof stopBattleBGM === 'function') stopBattleBGM();
            }
        }

        if (Object.prototype.hasOwnProperty.call(src, 'ambient')) {
            if (src.ambient) playStoryAmbient(src.ambient);
            else stopStoryAmbient();
        }

        // 画面全体の暗転（ゆっくり黒一色になる演出）。CSSのtransitionでフェードする。
        if (Object.prototype.hasOwnProperty.call(src, 'blackout')) {
            const blackoutEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackout');
            if (blackoutEl) blackoutEl.classList.toggle('story-reader-blackout-visible', !!src.blackout);
            // ブラックアウトを解除する時は、暗転中に表示していた中央フェードテキスト（centerText）が
            // 出しっぱなしにならないよう、ここで一緒に消す。
            if (!src.blackout) {
                const centerTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderCenterText');
                if (centerTextEl) { centerTextEl.classList.remove('story-center-text-visible'); centerTextEl.textContent = ''; }
            }
        }

        // ×（本編を閉じるボタン）の有効／無効。演出上、途中で離脱させたくない場面で使う。
        if (Object.prototype.hasOwnProperty.call(src, 'closeDisabled')) {
            storyLibraryState.readerCloseDisabled = !!src.closeDisabled;
        }

        if (src.se) {
            playStorySE(src.se);
        }
    }

    // デバッグ用：画面上部に今の内部状態（ページ/beat番号・busy・×無効化フラグ）を表示する。
    // 「進まなくなった」時に、リロードせずその場でどこで止まっているか報告してもらうための行。
    // 一般公開前に削除すること。
    function updateReaderDebugLine(extra) {
        if (!storyLibraryState.overlayEl) return;
        const el = storyLibraryState.overlayEl.querySelector('#storyReaderDebugLine');
        if (!el) return;
        const p = storyLibraryState.readerPageIndex;
        const b = storyLibraryState.readerBeatIndex;
        const busy = storyLibraryState.readerBusy ? 1 : 0;
        const close = storyLibraryState.readerCloseDisabled ? 1 : 0;
        el.textContent = STORY_ENGINE_BUILD + ' p' + p + ' b' + b + ' busy' + busy + ' close' + close + (extra ? ' ' + extra : '');
    }

    // 指定ページの背景・挿絵・BGM／環境音／効果音を反映し、1秒待ってからそのページの先頭のbeatを表示する。
    function showReaderPage(pageIndex) {
        clearStoryTypingTimer();
        // ページが切り替わった瞬間に、前のページで鳴らしたbeatごとの効果音（se）が再生し終わって
        // いなくても必ず止める（再生時間が長いSEを鳴らした直後にページをめくると、次のページに
        // 移っても鳴り続けてしまっていた不具合の修正）。BGM／環境音（ambient）は別チャンネルなので
        // 対象外（それぞれの場面でbgm:null／ambient:nullを指定して個別に止める）。
        stopAllStorySE();
        const pages = storyLibraryState.readerPages;
        const page = pages[pageIndex];
        if (!page) { endStoryReader(); return; }
        storyLibraryState.readerPageIndex = pageIndex;
        storyLibraryState.readerBusy = true;
        updateReaderDebugLine();

        const bgEl = storyLibraryState.overlayEl.querySelector('#storyReaderBg');
        if (bgEl && page.bg) bgEl.style.backgroundImage = "url('" + page.bg + "')";

        // ページが切り替わった瞬間に、前のページの文章は必ず消す（新しい挿絵が出ているのに
        // 前の文章がまだ見えている、という状態を作らないため）。
        const textArea = storyLibraryState.overlayEl.querySelector('#storyReaderTextArea');
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        const blackoutTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackoutText');
        if (textArea) { textArea.style.display = 'none'; textArea.innerHTML = ''; }
        if (layer) layer.style.display = 'none';
        if (blackoutTextEl) { blackoutTextEl.style.display = 'none'; blackoutTextEl.innerHTML = ''; }

        // シルエット／オーバーレイ／画面暗転は、ページ側で明示的に指定されていない限り、
        // ページが変わるタイミングでいったんリセットする（前のページの表示を持ち越さない）。
        if (!Object.prototype.hasOwnProperty.call(page, 'silhouette')) {
            const silEl = storyLibraryState.overlayEl.querySelector('#storyReaderSilhouette');
            if (silEl) { silEl.style.display = 'none'; silEl.removeAttribute('src'); }
        }
        if (!Object.prototype.hasOwnProperty.call(page, 'overlay')) {
            const overlayEl = storyLibraryState.overlayEl.querySelector('#storyReaderImageOverlay');
            if (overlayEl) overlayEl.style.display = 'none';
        }
        if (!Object.prototype.hasOwnProperty.call(page, 'blackout')) {
            const blackoutEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackout');
            if (blackoutEl) blackoutEl.classList.remove('story-reader-blackout-visible');
        }
        const centerTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderCenterText');
        if (centerTextEl) { centerTextEl.classList.remove('story-center-text-visible'); centerTextEl.textContent = ''; }

        applyReaderStageEffects(page);

        const prevBtn = storyLibraryState.overlayEl.querySelector('#storyReaderPrevBtn');
        if (prevBtn) prevBtn.style.display = pageIndex > 0 ? 'flex' : 'none';

        // 画像表示・音再生が済んだ状態で1秒待ってから、そのページの最初の文章を表示する。
        scheduleReaderStep(STORY_READER_PAGE_ENTRY_DELAY_MS, pageIndex, null, function() {
            showReaderBeat(0);
        });
    }

    // ページ内、指定位置のbeatを表示する（挿絵下テキスト or メッセージウインドウ、どちらか一方）。
    // テキストを持たない「制御用beat」（画像切替・BGM停止・シルエット変更などだけのもの）は、
    // 効果を適用したら自動的に次のbeatへ進む（waitがあれば、その時間だけ待ってから）。
    function showReaderBeat(beatIndex) {
        const page = storyLibraryState.readerPages[storyLibraryState.readerPageIndex];
        storyLibraryState.readerBeatIndex = beatIndex;
        const beat = (page.beats || [])[beatIndex];
        updateReaderDebugLine();
        if (!beat) { storyLibraryState.readerBusy = false; updateReaderDebugLine(); return; } // このページを表示し終えた状態（advanceStoryReaderがページ送りを担当）

        storyLibraryState.readerBusy = true;
        const pageIndex = storyLibraryState.readerPageIndex;
        updateReaderDebugLine();

        // セーフティネット：何らかの理由でこのbeatの自動進行が止まってしまった場合でも、
        // 6秒経ってまだ同じbeatでbusyのままならタップ操作を強制的に復帰させる
        // （原因が完全には特定できない不具合が起きても、リロードせずに再開できるようにするため）。
        scheduleReaderStep(6000, pageIndex, beatIndex, function() {
            if (storyLibraryState.readerBusy) {
                console.warn('[咖喱図書館] beat', beatIndex, 'で自動進行が止まっていたため復帰しました');
                storyLibraryState.readerBusy = false;
                updateReaderDebugLine('SAFETYNET');
            }
        });

        const run = function() {
            try {
                applyReaderStageEffects(beat);
                updateReaderDebugLine();

                if (beat.centerText !== undefined) {
                    // 「fin」が画面に表示される瞬間に読了扱いにする。このあとのdelay（間）や
                    // 次のbeat（×・◀を再び使えるようにする制御beat）を待たずに閉じる／リロード
                    // されても、「fin」さえ表示されていれば読了状態が保存されているようにするため。
                    if (beat.centerText === 'fin' && storyLibraryState.readerChapter) {
                        markStoryChapterRead(storyLibraryState.readerChapter.num);
                        updateStoryBookReadVisual(storyLibraryState.readerChapter);
                        updateStoryBookDetailReadOverlay(storyLibraryState.readerChapter);
                    }
                    // 暗転画面の中央にフェードイン／アウトしながら表示するテキスト
                    const textArea = storyLibraryState.overlayEl.querySelector('#storyReaderTextArea');
                    const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
                    const blackoutTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackoutText');
                    if (textArea) textArea.style.display = 'none';
                    if (layer) layer.style.display = 'none';
                    if (blackoutTextEl) { blackoutTextEl.style.display = 'none'; blackoutTextEl.innerHTML = ''; }
                    showReaderCenterText(beat.centerText, function() {
                        storyLibraryState.readerBusy = false; // フェードインが完了した時点でタップ待ちに
                        updateReaderDebugLine();
                    });
                } else if (beat.say || beat.narration || beat.text) {
                    renderReaderBeatText(beat);
                    storyLibraryState.readerBusy = false; // ここでタップ待ちの状態になる
                    updateReaderDebugLine();
                } else {
                    // テキストを持たない制御用beat：効果だけ適用して自動的に次のbeatへ進む
                    const nextIndex = beatIndex + 1;
                    if (beat.wait) {
                        scheduleReaderStep(beat.wait, pageIndex, beatIndex, function() {
                            showReaderBeat(nextIndex);
                        });
                    } else {
                        showReaderBeat(nextIndex);
                    }
                }
            } catch (err) {
                // ここで何らかの例外が起きると、以前はbusyがtrueのまま固まって進めなくなっていた。
                // 例外の中身を画面上に出した上で、tap待ちに復帰させ、致命的な固まりを防ぐ。
                console.error('[咖喱図書館] showReaderBeat run()で例外', err);
                storyLibraryState.readerBusy = false;
                updateReaderDebugLine('ERR:' + (err && err.message ? err.message : String(err)));
            }
        };

        // delayがあれば、何も表示しないまま指定時間だけ待ってから効果・文章を反映する
        if (beat.delay) {
            scheduleReaderStep(beat.delay, pageIndex, beatIndex, run);
        } else {
            run();
        }
    }

    // 画面中央のフェードテキストを更新する。既に何か表示されていれば、いったんフェードアウト
    // させてから次のテキストをフェードインさせる（クロスフェード）。フェードインが完了したらonDoneを呼ぶ。
    function showReaderCenterText(text, onDone) {
        const el = storyLibraryState.overlayEl.querySelector('#storyReaderCenterText');
        if (!el) { if (onDone) onDone(); return; }
        const isVisible = el.classList.contains('story-center-text-visible');
        const setText = function() {
            el.textContent = text;
            // requestAnimationFrameではなくsetTimeout(0)を使う（rAFが何らかの理由で
            // 呼ばれない環境があっても、こちらは確実にタイマーとして発火する）。
            setTimeout(function() {
                el.classList.add('story-center-text-visible');
                setTimeout(function() { if (onDone) onDone(); }, 600);
            }, 0);
        };
        if (isVisible) {
            el.classList.remove('story-center-text-visible');
            setTimeout(setText, 650);
        } else {
            setText();
        }
    }

    // beatのテキストを実際に画面に表示する（挿絵下のテキストエリア、またはメッセージウインドウ）。
    function renderReaderBeatText(beat) {
        const textArea = storyLibraryState.overlayEl.querySelector('#storyReaderTextArea');
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        const blackoutTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackoutText');
        if (beat.say || beat.narration) {
            // 既存のメッセージウインドウ（タイプライター＋効果音）を流用
            if (textArea) textArea.style.display = 'none';
            if (blackoutTextEl) { blackoutTextEl.style.display = 'none'; blackoutTextEl.innerHTML = ''; }
            showStoryDialogueLayerOnly(); // 館長の画像は出さず、ウインドウだけ表示
            const speaker = beat.say ? beat.say : '';
            const text = beat.say ? beat.text : beat.narration;
            startTypewriter(text, null, speaker);
        } else if (beat.text) {
            if (layer) layer.style.display = 'none';
            // 暗転（#storyReaderBlackout）中かどうかで表示先を切り替える。暗転中は通常の
            // #storyReaderTextAreaが黒画面の下に隠れてしまうため、暗転より前面に出る
            // #storyReaderBlackoutTextの方に同じ見た目・進め方で表示する。
            const blackoutEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackout');
            const isBlackedOut = !!(blackoutEl && blackoutEl.classList.contains('story-reader-blackout-visible'));
            if (isBlackedOut && blackoutTextEl) {
                if (textArea) { textArea.style.display = 'none'; textArea.innerHTML = ''; }
                blackoutTextEl.innerHTML = '';
                const span = document.createElement('span');
                span.textContent = beat.text;
                blackoutTextEl.appendChild(span);
                const arrow = document.createElement('span');
                arrow.id = 'storyReaderBlackoutTextArrow';
                arrow.textContent = '▼';
                blackoutTextEl.appendChild(document.createElement('br'));
                blackoutTextEl.appendChild(arrow);
                blackoutTextEl.style.display = 'block';
            } else {
                if (blackoutTextEl) { blackoutTextEl.style.display = 'none'; blackoutTextEl.innerHTML = ''; }
                // 絵本風のテキストエリアに即時表示（タイプライターなし・効果音なし）
                if (textArea) {
                    textArea.innerHTML = '';
                    const span = document.createElement('span');
                    span.textContent = beat.text;
                    textArea.appendChild(span);
                    const arrow = document.createElement('span');
                    arrow.id = 'storyReaderTextArrow';
                    arrow.textContent = '▼';
                    textArea.appendChild(document.createElement('br'));
                    textArea.appendChild(arrow);
                    textArea.style.display = 'block';
                }
            }
        }
    }

    // タップ時の進行。メッセージウインドウのbeatが文字送り中なら即完成、
    // 完成済み（あるいは絵本風テキストのbeat）なら次のbeatへ、ページの最後まで来ていたら次ページへめくる。
    function advanceStoryReader() {
        const page = storyLibraryState.readerPages[storyLibraryState.readerPageIndex];
        const beat = (page.beats || [])[storyLibraryState.readerBeatIndex];
        if (beat && (beat.say || beat.narration) && !storyLibraryState.typingDone) {
            completeTypewriterInstantly();
            return;
        }
        const nextBeatIndex = storyLibraryState.readerBeatIndex + 1;
        if (page.beats && nextBeatIndex < page.beats.length) {
            showReaderBeat(nextBeatIndex);
        } else {
            goToNextReaderPage();
        }
    }

    function goToNextReaderPage() {
        const nextIndex = storyLibraryState.readerPageIndex + 1;
        if (storyLibraryState.readerPages[nextIndex]) {
            showReaderPage(nextIndex);
        } else {
            // 最後のページまで読み終えた：読了状態を記録し、表紙のeyes.gif演出を反映する
            const chapter = storyLibraryState.readerChapter;
            if (chapter) {
                markStoryChapterRead(chapter.num);
                updateStoryBookReadVisual(chapter);
            }
            endStoryReader();
        }
    }

    function goToPrevReaderPage() {
        if (storyLibraryState.mode !== 'reader') return;
        const prevIndex = storyLibraryState.readerPageIndex - 1;
        if (prevIndex >= 0) {
            showReaderPage(prevIndex);
        }
    }

    function endStoryReader() {
        clearStoryTypingTimer();
        stopAllStorySE(); // 長い効果音が鳴ったままにならないよう、閉じる時に必ず止める（BGM/環境音は対象外）
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        const box = storyLibraryState.overlayEl.querySelector('#storyMessageBox');
        const nameEl = storyLibraryState.overlayEl.querySelector('#storyMessageName');
        const textArea = storyLibraryState.overlayEl.querySelector('#storyReaderTextArea');
        const imgWrap = storyLibraryState.overlayEl.querySelector('#storyReaderImageWrap');
        const imgEl = storyLibraryState.overlayEl.querySelector('#storyReaderImage');
        const silEl = storyLibraryState.overlayEl.querySelector('#storyReaderSilhouette');
        const overlayEl = storyLibraryState.overlayEl.querySelector('#storyReaderImageOverlay');
        const blackoutEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackout');
        const centerTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderCenterText');
        const blackoutTextEl = storyLibraryState.overlayEl.querySelector('#storyReaderBlackoutText');
        const readerOverlay = storyLibraryState.overlayEl.querySelector('#storyReaderOverlay');
        const readerCloseBtn = storyLibraryState.overlayEl.querySelector('#storyReaderCloseBtn');
        const prevBtn = storyLibraryState.overlayEl.querySelector('#storyReaderPrevBtn');
        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        const detailCloseBtn = storyLibraryState.overlayEl.querySelector('#storyBookDetailCloseBtn');

        if (box) box.style.display = 'none';
        if (nameEl) nameEl.style.display = 'none';
        if (layer) layer.style.display = 'none';
        if (textArea) { textArea.style.display = 'none'; textArea.innerHTML = ''; }
        if (blackoutTextEl) { blackoutTextEl.style.display = 'none'; blackoutTextEl.innerHTML = ''; }
        if (imgWrap) imgWrap.style.display = 'none';
        if (imgEl) imgEl.removeAttribute('src');
        if (silEl) { silEl.style.display = 'none'; silEl.removeAttribute('src'); }
        if (overlayEl) overlayEl.style.display = 'none';
        if (blackoutEl) blackoutEl.classList.remove('story-reader-blackout-visible');
        if (centerTextEl) { centerTextEl.classList.remove('story-center-text-visible'); centerTextEl.textContent = ''; }
        if (readerOverlay) readerOverlay.style.display = 'none';
        if (readerCloseBtn) readerCloseBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        stopStoryAmbient(); // 環境音（雨音など）も本編を離れるタイミングで必ず止める

        storyLibraryState.readerPages = [];
        storyLibraryState.readerPageIndex = 0;
        storyLibraryState.readerBeatIndex = 0;
        storyLibraryState.readerChapter = null;
        storyLibraryState.readerBgmSrc = null;
        storyLibraryState.readerBusy = false;
        storyLibraryState.readerCloseDisabled = false;
        storyLibraryState.mode = 'carousel';

        // 呼び出し元（本の拡大画面）に戻す
        if (detailOverlay) detailOverlay.style.display = 'flex';
        if (detailCloseBtn) detailCloseBtn.style.display = 'flex';
        // 本編読書中に隠していた想いの欠片バッジの表示状態を、通常のルールに戻す
        updateKakeraDisplays();
        // 読了したことで「読む」→「戦う」に変わった可能性があるので、拡大画面のボタンを更新する
        if (storyLibraryState.currentDetailChapter) {
            updateStoryBookDetailActionButton(storyLibraryState.currentDetailChapter);
            maybeStartBookBossIntro(storyLibraryState.currentDetailChapter);
        }

        // 咖喱図書館のBGMに戻す
        if (typeof playBattleBGM === 'function') {
            playBattleBGM(STORY_BGM_SRC);
        }
    }

    // ===== 店主との会話（共通の会話エンジン） =====

    function onStoryStageClick() {
        if (storyLibraryState.mode === 'intro_wait_tap') {
            startIntroDialogue();
        } else if (storyLibraryState.mode === 'intro_dialogue') {
            if (storyLibraryState.dialogueStarting) return; // 登場演出～セリフ開始までの間はタップを無視
            handleDialogueTap();
        } else if (storyLibraryState.mode === 'reader') {
            if (storyLibraryState.readerBusy) return; // 自動進行中（開始直後の間や、待機演出中）はタップを無視
            advanceStoryReader();
        }
        // carousel モードでは何もしない（ドラッグ／本のクリックのみ有効）
    }

    function showStoryLibraryman() {
        storyLibraryState.dialogueSession++;
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        const manImg = storyLibraryState.overlayEl.querySelector('#storyLibraryman');
        layer.style.display = 'block';
        manImg.classList.remove('story-man-visible');
        // 少し間を置いて店主を表示（フェードイン）
        requestAnimationFrame(function() {
            manImg.classList.add('story-man-visible');
        });
    }

    // 館長の画像は出さず、会話レイヤー（メッセージウインドウ）だけを表示する。
    // 本の拡大画面でのセリフ表示用（本の拡大画面では館長の画像は不要なため）。
    function showStoryDialogueLayerOnly() {
        storyLibraryState.dialogueSession++;
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        layer.style.display = 'block';
    }

    // 指定時間後に最初のセリフ表示を開始する。待っている間にタップされてもページが
    // 飛ばされないよう、開始するまでdialogueStartingフラグを立てておく。
    function scheduleDialogueStart(delayMs) {
        storyLibraryState.dialogueStarting = true;
        setTimeout(function() {
            storyLibraryState.dialogueStarting = false;
            showCurrentDialoguePage();
        }, delayMs);
    }

    function startIntroDialogue() {
        storyLibraryState.mode = 'intro_dialogue';
        storyLibraryState.dialogueQueue = buildStoryIntroPages();
        storyLibraryState.dialogueIndex = 0;
        storyLibraryState.onDialogueEnd = function() {
            if (storyLibraryState.pendingUnlock) {
                setStoryLibraryUnlocked(true);
                storyLibraryState.unlocked = true;
                storyLibraryState.mode = 'carousel';
            } else {
                // 「いいえ」を選んだ場合は本を出さないまま。もう一度タップすれば再度尋ねられる。
                storyLibraryState.mode = 'intro_wait_tap';
            }
        };
        showStoryLibraryman();
        scheduleDialogueStart(500);
    }

    function showCurrentDialoguePage() {
        const page = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        if (!page) { endDialogueSequence(); return; }
        if (typeof page.beforeShow === 'function') page.beforeShow();
        const delay = page.preDelayMs || 0;
        if (delay > 0) {
            // 演出（本が降ってくる等）とセリフ表示が重ならないよう、少し待ってから文字送りを始める。
            // 待っている間にタップされてもページを飛ばさないよう、先にtypingDoneをfalseにしておく。
            storyLibraryState.typingDone = false;
            const arrow = storyLibraryState.overlayEl.querySelector('#storyMessageArrow');
            if (arrow) arrow.style.display = 'none';
            setTimeout(function() {
                if (storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex] === page) {
                    startTypewriter(page.text, page.choices || null);
                }
            }, delay);
        } else {
            startTypewriter(page.text, page.choices || null);
        }
    }

    // speaker省略時は従来通り「館長」（咖喱図書館の会話で使用）。
    // 本編（本の中のストーリー）ではspeakerに話者名を渡すか、ナレーションの場合は空文字''を渡して名前欄を隠す。
    function startTypewriter(text, choices, speaker) {
        clearStoryTypingTimer();
        const box = storyLibraryState.overlayEl.querySelector('#storyMessageBox');
        const nameEl = storyLibraryState.overlayEl.querySelector('#storyMessageName');
        const textEl = storyLibraryState.overlayEl.querySelector('#storyMessageText');
        const arrow = storyLibraryState.overlayEl.querySelector('#storyMessageArrow');
        const choicesEl = storyLibraryState.overlayEl.querySelector('#storyMessageChoices');
        box.style.display = 'flex';
        if (speaker === undefined) speaker = STORY_SPEAKER_NAME;
        if (nameEl) {
            if (speaker) { nameEl.textContent = speaker; nameEl.style.display = 'block'; }
            else { nameEl.style.display = 'none'; }
        }
        choicesEl.style.display = 'none';
        choicesEl.innerHTML = '';
        arrow.style.display = 'none';
        textEl.textContent = '';

        storyLibraryState.typingText = text;
        storyLibraryState.typingIndex = 0;
        storyLibraryState.typingDone = false;
        storyLibraryState.pendingChoices = choices;

        // メッセージ音はウインドウ（ページ）ごとに1回だけ再生する（1文字ごとだと多重再生されるため）。
        if (typeof playSoundEffect === 'function') {
            playSoundEffect(STORY_MESSAGE_SE);
        }

        storyLibraryState.typingTimer = setInterval(advanceTypewriter, STORY_TYPE_INTERVAL_MS);
    }

    function advanceTypewriter() {
        const textEl = storyLibraryState.overlayEl.querySelector('#storyMessageText');
        const text = storyLibraryState.typingText;
        if (storyLibraryState.typingIndex >= text.length) {
            finishTypewriter();
            return;
        }
        storyLibraryState.typingIndex++;
        textEl.textContent = text.slice(0, storyLibraryState.typingIndex);
        if (storyLibraryState.typingIndex >= text.length) {
            finishTypewriter();
        }
    }

    function completeTypewriterInstantly() {
        const textEl = storyLibraryState.overlayEl.querySelector('#storyMessageText');
        clearStoryTypingTimer();
        textEl.textContent = storyLibraryState.typingText;
        storyLibraryState.typingIndex = storyLibraryState.typingText.length;
        finishTypewriter();
    }

    function finishTypewriter() {
        clearStoryTypingTimer();
        storyLibraryState.typingDone = true;
        const arrow = storyLibraryState.overlayEl.querySelector('#storyMessageArrow');
        const choicesEl = storyLibraryState.overlayEl.querySelector('#storyMessageChoices');
        if (storyLibraryState.pendingChoices) {
            choicesEl.innerHTML = '';
            storyLibraryState.pendingChoices.forEach(function(c) {
                const b = document.createElement('button');
                b.className = 'story-choice-btn';
                b.textContent = c.label;
                b.addEventListener('click', function(e) {
                    e.stopPropagation();
                    choicesEl.style.display = 'none';
                    onChoiceSelected(c.value);
                });
                choicesEl.appendChild(b);
            });
            choicesEl.style.display = 'flex';
            arrow.style.display = 'none';
        } else {
            arrow.style.display = 'block';
        }
    }

    function clearStoryTypingTimer() {
        if (storyLibraryState.typingTimer) {
            clearInterval(storyLibraryState.typingTimer);
            storyLibraryState.typingTimer = null;
        }
    }

    function handleDialogueTap() {
        if (!storyLibraryState.typingDone) {
            completeTypewriterInstantly();
            return;
        }
        const page = storyLibraryState.dialogueQueue[storyLibraryState.dialogueIndex];
        if (page && page.choices) return; // 選択肢が出ている間はボタン以外での進行を無視
        if (page && page.waitForExternalTrigger) return; // 外部の操作（想いの欠片タップ等）が起きるまで自然には進めない
        storyLibraryState.dialogueIndex++;
        showCurrentDialoguePage();
    }

    function onChoiceSelected(value) {
        storyLibraryState.pendingUnlock = (value === true);
        if (value === true) {
            storyLibraryState.dialogueQueue.push({ text: STORY_ACCEPT_TEXT, beforeShow: revealStoryBooks, preDelayMs: STORY_BOOK_REVEAL_WAIT_MS });
        } else {
            storyLibraryState.dialogueQueue.push({ text: STORY_DECLINE_TEXT });
        }
        storyLibraryState.dialogueIndex++;
        showCurrentDialoguePage();
    }

    // 背景レイヤーと店主画像レイヤーの間（本棚レイヤー）に、本を1冊ずつ時間差で降らせるように出現させる。
    function revealStoryBooks() {
        if (storyLibraryState.booksRevealed) return;
        storyLibraryState.booksRevealed = true;
        storyLibraryState.revealStartTs = performance.now();
        const perspective = storyLibraryState.overlayEl.querySelector('#storyLibraryPerspective');
        if (perspective) perspective.style.display = '';
        STORY_CHAPTERS.forEach(function(chapter, i) {
            chapter._spawnDelay = i * STORY_BOOK_SPAWN_STAGGER_MS;
        });
        if (typeof playSoundEffect === 'function') {
            playSoundEffect(STORY_BOOK_FALL_SE);
        }
    }

    function endDialogueSequence() {
        const layer = storyLibraryState.overlayEl.querySelector('#storyDialogueLayer');
        const manImg = storyLibraryState.overlayEl.querySelector('#storyLibraryman');
        const box = storyLibraryState.overlayEl.querySelector('#storyMessageBox');
        const nameEl = storyLibraryState.overlayEl.querySelector('#storyMessageName');
        manImg.classList.remove('story-man-visible');
        if (box) box.style.display = 'none';
        if (nameEl) nameEl.style.display = 'none';
        // 直後に次の会話が続けて始まっている場合（dialogueSessionが進んでいる場合）は、
        // ここで古いタイマーがレイヤーを閉じてしまわないようにする。
        const mySession = storyLibraryState.dialogueSession;
        setTimeout(function() {
            if (layer && storyLibraryState.dialogueSession === mySession) layer.style.display = 'none';
        }, 400);

        const cb = storyLibraryState.onDialogueEnd;
        storyLibraryState.onDialogueEnd = null;
        if (typeof cb === 'function') cb();
    }

    function closeStoryLibrary() {
        if (isLibraryCloseBlocked()) return; // 「想いの欠片をタップしてみな」の間は×を無効にする
        if (storyLibraryState.rafId) cancelAnimationFrame(storyLibraryState.rafId);
        storyLibraryState.rafId = null;
        clearStoryTypingTimer();
        window.removeEventListener('resize', updateStoryLibraryScale);
        window.removeEventListener('orientationchange', updateStoryLibraryScale);
        stopStoryAmbient();
        if (typeof stopBattleBGM === 'function') {
            stopBattleBGM();
        }
        if (storyLibraryState.overlayEl) {
            storyLibraryState.overlayEl.remove();
        }
        storyLibraryState.overlayEl = null;
        STORY_CHAPTERS.forEach(function(chapter) {
            chapter._wrapperEl = null;
            chapter._innerEl = null;
            chapter._frontEl = null;
            chapter._backEl = null;
            chapter._lockEl = null;
            chapter._spawnDelay = undefined;
        });
    }

    document.addEventListener('DOMContentLoaded', initStoryLibrary);
})();
