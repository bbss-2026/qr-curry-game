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
    const STORY_CHAPTER_COUNT = 10;
    const STORY_CHAPTERS = [];
    for (let i = 1; i <= STORY_CHAPTER_COUNT; i++) {
        const num = String(i).padStart(2, '0');
        STORY_CHAPTERS.push({
            frontImage: 'story/book-' + num + '.png',
            backImage: 'story/book2-' + num + '.png',
        });
    }
    const STORY_FLOAT_INTENSITY = 22;
    const STORY_AUTO_ROTATE_SPEED = 0.045; // 1フレームあたりの回転角度（度）
    const STORY_BGM_SRC = 'story/library-bgm.mp3';
    const STORY_STAGE_REF_WIDTH = 500; // 本棚の3D演出はこの基準幅で設計されている

    const storyLibraryState = {
        overlayEl: null,
        rafId: null,
        rotationY: 0,
        t: 0,
        dragging: false,
        dragMoved: false,
        startX: 0,
        startRot: 0,
    };

    // ===== 初期化 =====
    function initStoryLibrary() {
        injectStoryLibraryStyles();
        injectStoryLibraryEntryButton();
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
    }

    function injectStoryLibraryStyles() {
        if (document.getElementById('storyLibraryStyles')) return;
        const style = document.createElement('style');
        style.id = 'storyLibraryStyles';
        style.textContent = `
#storyLibraryOverlay { position:fixed; inset:0; z-index:9999; background:#000; }
#storyLibraryStage {
    position:relative; width:100%; max-width:500px; height:100%; margin:0 auto;
    background-image:url('story/currylibrary_bg2.png'); background-size:cover; background-position:center;
    overflow:hidden; touch-action:none; user-select:none; cursor:grab; font-family:inherit;
}
#storyLibraryPerspective { position:absolute; inset:0; perspective:1400px; }
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
#storyLibraryCloseBtn {
    position:absolute; top:16px; left:16px; z-index:10; width:36px; height:36px; border-radius:999px;
    background:rgba(0,0,0,0.45); color:#fff; border:1px solid rgba(255,255,255,0.4); font-size:16px;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
}
#storyMuteBtn {
    position:absolute; top:8px; right:8px; width:32px; height:32px; border:none; background:transparent;
    cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; padding:0;
}
#storyMuteBtn img { width:28px; height:28px; }
#storyBookDetailOverlay {
    position:absolute; inset:0; background:rgba(250,248,244,0.92); backdrop-filter:blur(10px);
    z-index:20; display:flex; align-items:center; justify-content:center;
}
.story-book-detail-cover {
    width:60%; max-width:260px; aspect-ratio:0.72; border-radius:8px; background-color:#3a2c1f;
    background-size:cover; background-position:center;
    box-shadow:0 40px 60px -20px rgba(0,0,0,0.3);
}
#storyBookDetailCloseBtn {
    position:absolute; top:32px; right:24px; background:none; border:1px solid rgba(0,0,0,0.3);
    border-radius:999px; width:40px; height:40px; font-size:16px; color:#3a342c; cursor:pointer;
}
        `;
        document.head.appendChild(style);
    }

    // 咖喱図書館のメイン画面表示（3D回転本棚UI）
    function openStoryLibrary() {
        if (storyLibraryState.overlayEl) return; // 既に開いている場合は何もしない
        buildStoryLibraryOverlay();
    }

    function buildStoryLibraryOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'storyLibraryOverlay';
        overlay.innerHTML =
            '<div id="storyLibraryStage">'
            + '<div id="storyLibraryPerspective"><div id="storyBooksWrap"></div></div>'
            + '<button id="storyLibraryCloseBtn">✕</button>'
            + '<button id="storyMuteBtn"><img id="storyMuteIcon" src="sound-on.svg" alt="sound"></button>'
            + '<div id="storyBookDetailOverlay" style="display:none;">'
            + '<button id="storyBookDetailCloseBtn">✕</button>'
            + '<div id="storyBookDetailCard"></div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(overlay);
        storyLibraryState.overlayEl = overlay;

        const booksWrap = overlay.querySelector('#storyBooksWrap');
        STORY_CHAPTERS.forEach(function(chapter) {
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

            inner.appendChild(front);
            inner.appendChild(back);
            inner.addEventListener('click', function() { onStoryBookClick(chapter); });
            wrapper.appendChild(inner);
            booksWrap.appendChild(wrapper);

            chapter._wrapperEl = wrapper;
            chapter._innerEl = inner;
            chapter._frontEl = front;
            chapter._backEl = back;
        });

        const stage = overlay.querySelector('#storyLibraryStage');
        stage.addEventListener('pointerdown', onStoryDragStart);
        stage.addEventListener('pointermove', onStoryDragMove);
        stage.addEventListener('pointerup', onStoryDragEnd);
        stage.addEventListener('pointerleave', onStoryDragEnd);

        overlay.querySelector('#storyLibraryCloseBtn').addEventListener('click', closeStoryLibrary);
        overlay.querySelector('#storyBookDetailCloseBtn').addEventListener('click', closeStoryBookDetail);
        overlay.querySelector('#storyMuteBtn').addEventListener('click', onStoryMuteToggle);

        storyLibraryState.rotationY = 0;
        storyLibraryState.dragging = false;
        storyLibraryState.dragMoved = false;

        updateStoryLibraryScale();
        window.addEventListener('resize', updateStoryLibraryScale);
        window.addEventListener('orientationchange', updateStoryLibraryScale);

        updateStoryMuteIcon();
        if (typeof playBattleBGM === 'function') {
            playBattleBGM(STORY_BGM_SRC);
        }

        storyLibraryState.rafId = requestAnimationFrame(storyLibraryTick);
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

    function storyLibraryTick(ts) {
        const t = ts / 1000;
        if (!storyLibraryState.dragging) {
            storyLibraryState.rotationY += STORY_AUTO_ROTATE_SPEED;
        }
        storyLibraryState.t = t;
        renderStoryBooks(t);
        storyLibraryState.rafId = requestAnimationFrame(storyLibraryTick);
    }

    function renderStoryBooks(t) {
        if (!storyLibraryState.overlayEl) return;
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

            chapter._wrapperEl.style.transform = 'rotateY(' + angle + 'deg) translateZ(' + radius + 'px)';
            chapter._innerEl.style.transform =
                'translate(-50%,-60%) translateY(' + bob + 'px) rotateZ(' + wobble + 'deg) scale(' + breathe + ')';

            const normalizedAngle = ((angle + rotationY) % 360 + 360) % 360;
            const diff = normalizedAngle > 180 ? 360 - normalizedAngle : normalizedAngle;
            const showBack = diff > 90;
            chapter._frontEl.style.opacity = showBack ? '0' : '1';
            chapter._backEl.style.opacity = showBack ? '1' : '0';
        });
    }

    function onStoryDragStart(e) {
        storyLibraryState.dragging = true;
        storyLibraryState.dragMoved = false;
        storyLibraryState.startX = e.clientX;
        storyLibraryState.startRot = storyLibraryState.rotationY;
        const stage = storyLibraryState.overlayEl.querySelector('#storyLibraryStage');
        if (stage) stage.style.cursor = 'grabbing';
    }
    function onStoryDragMove(e) {
        if (!storyLibraryState.dragging) return;
        const delta = e.clientX - storyLibraryState.startX;
        if (Math.abs(delta) > 5) storyLibraryState.dragMoved = true;
        storyLibraryState.rotationY = storyLibraryState.startRot + delta * 0.35;
    }
    function onStoryDragEnd() {
        storyLibraryState.dragging = false;
        if (storyLibraryState.overlayEl) {
            const stage = storyLibraryState.overlayEl.querySelector('#storyLibraryStage');
            if (stage) stage.style.cursor = 'grab';
        }
    }

    function onStoryBookClick(chapter) {
        if (storyLibraryState.dragMoved) return;
        openStoryBookDetail(chapter);
    }

    function openStoryBookDetail(chapter) {
        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        const card = storyLibraryState.overlayEl.querySelector('#storyBookDetailCard');
        card.className = 'story-book-detail-cover';
        card.style.backgroundImage = "url('" + chapter.frontImage + "')";
        detailOverlay.style.display = 'flex';
    }
    function closeStoryBookDetail() {
        const detailOverlay = storyLibraryState.overlayEl.querySelector('#storyBookDetailOverlay');
        if (detailOverlay) detailOverlay.style.display = 'none';
    }

    function closeStoryLibrary() {
        if (storyLibraryState.rafId) cancelAnimationFrame(storyLibraryState.rafId);
        storyLibraryState.rafId = null;
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
        });
    }

    document.addEventListener('DOMContentLoaded', initStoryLibrary);
})();
