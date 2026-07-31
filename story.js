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
        dialogueSession: 0, // 会話セッションの世代番号（連続して次の会話に繋げた時、古いsetTimeoutが誤って新しい会話を隠さないようにする）
        currentDetailChapter: null, // 現在、拡大表示中の本（解放／読むボタンの対象）
    };

    // ===== 初期化 =====
    function initStoryLibrary() {
        injectStoryLibraryStyles();
        injectStoryLibraryFont();
        injectStoryLibraryEntryButton();
        installStoryKakeraHooks();
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
            STORY_CHAPTERS.forEach(function(chapter) {
                chapter.locked = true;
                if (chapter._lockEl) chapter._lockEl.style.display = '';
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
#storyBookDetailActionBtn {
    background:rgba(35,28,18,0.85); color:#fff; border:1px solid rgba(255,255,255,0.4);
    border-radius:999px; padding:10px 34px; font-size:14px; font-weight:bold; cursor:pointer;
    box-shadow:0 8px 20px rgba(0,0,0,0.25); display:none;
}
#storyBookDetailActionBtn:active { background:rgba(60,48,32,0.9); }
#storyBookDetailActionBtn.story-book-action-disabled { opacity:0.5; cursor:default; }
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
            + '<button id="storyBookDetailActionBtn"></button>'
            + '</div>'
            + '</div>'
            + '<div id="storyKakeraInfoOverlay" style="display:none;">'
            + '<button id="storyKakeraInfoCloseBtn">✕</button>'
            + '<div id="storyKakeraInfoCard"></div>'
            + '</div>'
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
        detailOverlay.style.display = 'flex';
        // 咖喱図書館から出る×（左上）と本棚に戻る×が同時に出て紛らわしくならないよう、
        // 本の表紙表示中は咖喱図書館から出る×を隠す（本棚に戻る×が同じ位置に表示される）。
        if (libraryCloseBtn) libraryCloseBtn.style.display = 'none';

        updateKakeraDisplays();
        updateStoryBookDetailActionButton(chapter);
        maybeStartKakeraBookIntro();
    }
    function closeStoryBookDetail() {
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
            { text: '「いったん左上の「×」を押して\n戻ってくるのだ」' },
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

    function updateStoryBookDetailActionButton(chapter) {
        const btn = storyLibraryState.overlayEl.querySelector('#storyBookDetailActionBtn');
        if (!btn) return;
        btn.onclick = null;
        btn.classList.remove('story-book-action-disabled');
        if (!chapter.locked) {
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
        // TODO: 各巻の本文（ストーリー本編）を実装したら、ここから該当ストーリーに遷移する。
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('準備中', 'このストーリーは準備中です。');
        }
    }

    // ===== 店主との会話（共通の会話エンジン） =====

    function onStoryStageClick() {
        if (storyLibraryState.mode === 'intro_wait_tap') {
            startIntroDialogue();
        } else if (storyLibraryState.mode === 'intro_dialogue') {
            if (storyLibraryState.dialogueStarting) return; // 登場演出～セリフ開始までの間はタップを無視
            handleDialogueTap();
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

    function startTypewriter(text, choices) {
        clearStoryTypingTimer();
        const box = storyLibraryState.overlayEl.querySelector('#storyMessageBox');
        const nameEl = storyLibraryState.overlayEl.querySelector('#storyMessageName');
        const textEl = storyLibraryState.overlayEl.querySelector('#storyMessageText');
        const arrow = storyLibraryState.overlayEl.querySelector('#storyMessageArrow');
        const choicesEl = storyLibraryState.overlayEl.querySelector('#storyMessageChoices');
        box.style.display = 'flex';
        if (nameEl) { nameEl.textContent = STORY_SPEAKER_NAME; nameEl.style.display = 'block'; }
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
        if (storyLibraryState.rafId) cancelAnimationFrame(storyLibraryState.rafId);
        storyLibraryState.rafId = null;
        clearStoryTypingTimer();
        window.removeEventListener('resize', updateStoryLibraryScale);
        window.removeEventListener('orientationchange', updateStoryLibraryScale);
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
