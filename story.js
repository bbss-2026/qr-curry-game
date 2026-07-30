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
// ・STORY_LIBRARY_ENABLEDがfalseの間は、DOMに一切手を加えない。
//   ＝既存プレイヤーからは完全に見えない・存在しないのと同じ状態。
//   実装が完了したら、このフラグをtrueにするだけで公開できる。
// ・このファイルはgame.jsより後に読み込まれる前提（game.html内のscriptタグの順序に依存）。

const STORY_LIBRARY_ENABLED = false; // ← 完成して公開する時にtrueへ変更する

(function() {
    if (!STORY_LIBRARY_ENABLED) return; // 準備中はここで即終了。DOM操作も一切行わない。

    // ===== 初期化 =====
    function initStoryLibrary() {
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
        btn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;height:100%;font-weight:bold;">📚 咖喱図書館</span>';
        anchor.parentNode.appendChild(btn);
    }

    // 咖喱図書館のメイン画面表示（仮実装）
    function openStoryLibrary() {
        // TODO: 咖喱図書館のメイン画面をここに実装する。
        // 既存のshowCustomAlert / playerG / saveGame 等、game.js側の関数・変数はそのまま呼び出せる。
        showCustomAlert('📚 咖喱図書館', '準備中です。');
    }

    document.addEventListener('DOMContentLoaded', initStoryLibrary);
})();
