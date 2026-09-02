// ============================================================
// ボードカレーバトル 専用ファイル
// ============================================================
// 【開発方針】（story.jsと同じ方針）
// ・本体（game.js）には手を加えず、このファイルの中だけで開発を進める
//   （唯一の例外：本編に3か所だけ追加した window.startExternalBoardBattle フックと、
//   done()/step()のisBoardBattle分岐。いずれも既存の挙動には一切影響しない追加のみ）。
// ・カレー画像判定（getCurryType/getCurryImage）・カレーストック（curryStock）・
//   戦闘エンジン（startExternalBoardBattle経由でlaunchVsCutIn以下一式）は、
//   すべてgame.js側の既存グローバルをそのまま利用する（再実装・二重管理はしない）。
// ・game.html側の変更は、このファイルを読み込む<script>タグ1行のみで完結させる。
//   入り口ボタン等のDOM要素は、すべてこのファイルからJSで動的に追加する。
// ・game.js・story.jsより後に読み込まれる前提（applyBookBattleLift等はstory.js側の定義）。
// ・このファイル内のDOM ID・CSSクラス名はすべて「bb」プレフィックスを付け、
//   本体の巨大なgame.htmlに既存のID・クラス名と絶対に衝突しないようにしている。
// ・カレー駒の見た目には絵文字を一切使用しない（本編と同じgetCurryImageのみを使用）。
// ・戦闘は「PCと対戦」の戦闘エンジンをstartExternalBoardBattle経由でそのまま起動する。
//   iframeや別ウィンドウは使わず、本体と同じ1つのJS実行環境の中で直接関数を呼ぶため、
//   タイトル画面・タブ切り替え・戦闘画面の表示状態など、本体側の状態にそのまま乗る形になる
//   （＝別ドキュメントを無理に起動するときに起きていた諸問題が構造的に発生しない）。
// ============================================================
(function () {

// ------------------------------------------------------------
// 0. スタイル注入（#bbRoot配下にのみ影響する。グローバルセレクタ(*、body等)は使わない）
// ------------------------------------------------------------
const BB_STYLE = `
#bbRoot, #bbRoot * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
#bbRoot {
    position: fixed; inset: 0; z-index: 9000; display: none; flex-direction: column;
    background: #2b1a0e; color: #efdeb1;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    overscroll-behavior: none; user-select: none;
}
#bbAppRoot { max-width: 720px; margin: 0 auto; width: 100%; height: 100%; position: relative; overflow: hidden; }

/* 地図アプリのように：盤面（#bbBoardWrap）は画面いっぱいに自由にパン・ズームでき、
   ヘッダー／行動順アイコン／メッセージウインドウは常に固定位置に浮かせて重ねて表示する。 */
#bbTopOverlay { position: absolute; top: 0; left: 0; right: 0; z-index: 25; display: flex; flex-direction: column; }

#bbHeaderBar {
    background: rgba(66,0,0,0.92); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #b88742; flex-shrink: 0;
}
#bbHeaderBar h1 { font-size: 14px; margin: 0; letter-spacing: 0.05em; color: #efdeb1; }
#bbHeaderBar .bb-header-right { display: flex; align-items: center; gap: 8px; }
.bb-devBadge { font-size: 10px; background: #b88742; color: #420000; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
.bb-closeBtn { background: none; border: 1px solid #b88742; color: #efdeb1; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }

#bbTurnQueueBar {
    display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(58,36,19,0.88);
    border-bottom: 1px solid rgba(107,74,38,0.8); overflow-x: auto; min-height: 62px; flex-shrink: 0;
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
}
.bb-turnIcon {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; position: relative;
    border: 2px solid #888; background: #efdeb1; opacity: 0.85; overflow: hidden;
    transition: transform 0.15s ease;
}
.bb-turnIcon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-turnIcon.bb-team-player { border-color: #3498db; }
.bb-turnIcon.bb-team-enemy { border-color: #e74c3c; }
.bb-turnIcon.bb-current { width: 52px; height: 52px; opacity: 1; transform: scale(1.05); box-shadow: 0 0 12px rgba(255,255,255,0.6); }

/* 盤面は#bbAppRoot全体に敷き詰め、ヘッダー等の下にも回り込ませる（地図アプリのタイル層と同じ考え方）。
   ネイティブのスクロール（overflow:auto）は使わず、pointer/wheelイベントで自前のパン・ズームを実装する。 */
/* 盤面を斜め上から見下ろしたような立体感を出すため、SVG本体だけにCSSの3D変形を掛ける。
   パン・ズームのポインタ計算（bbGetWrapPoint等）は#bbBoardWrap自身のgetBoundingClientRect()
   を基準にしており、#bbBoardWrapそのものは変形させていないため、ドラッグ・ピンチ・タップの
   当たり判定には影響しない（ブラウザは3D変形後の見た目の位置からでもクリック対象を
   正しく解決してくれるため、タイルのタップ自体も問題なく機能する）。 */
#bbBoardWrap { position: absolute; inset: 0; overflow: hidden; touch-action: none; background: #2b1a0e; perspective: 1400px; }
#bbBoardSvg {
    width: 100%; height: 100%; display: block;
    transform: rotateX(24deg);
    transform-origin: 50% 50%;
}
.bb-board-edge { stroke: #6b4a26; stroke-width: 2; }
.bb-board-node-tile { fill: #efdeb1; stroke: #6b4a26; stroke-width: 3; cursor: default; }
.bb-board-node-tile.bb-flag-tile { fill: #f5e9c8; stroke: #b88742; stroke-width: 4; }
.bb-board-node-tile.bb-selectable { stroke: #2ecc71; stroke-width: 4; cursor: pointer; }
.bb-board-node-tile.bb-movable { stroke: #f1c40f; stroke-width: 4; cursor: pointer; }
.bb-board-node-tile.bb-attackable { stroke: #ff4136; stroke-width: 5; cursor: pointer; }
.bb-board-node-tile.bb-occupied-player { stroke: #3498db; }
.bb-board-node-tile.bb-occupied-enemy { stroke: #e74c3c; }
.bb-active-ring {
    fill: none; stroke: #ffe066; stroke-width: 4; opacity: 0.9;
    transform-box: fill-box; transform-origin: center;
    animation: bbActivePulse 0.9s ease-out infinite;
}
@keyframes bbActivePulse {
    0%   { transform: scale(1);   opacity: 0.9; }
    100% { transform: scale(1.45);opacity: 0; }
}
.bb-board-node-tile.bb-active-turn { stroke: #ffe066; stroke-width: 5; }
.bb-board-hp-bg { fill: #222; }
.bb-board-hp-fill { fill: #2ecc71; }
/* 特殊マス（画像は未整備のため、色分け＋漢字1文字で暫定表示） */
.bb-board-node-tile.bb-terrain-rock { fill: #6b6459; }
.bb-board-node-tile.bb-terrain-water { fill: #2e6f9e; }
.bb-board-node-tile.bb-terrain-poison { fill: #6a2e7a; }
.bb-terrain-label { font-size: 20px; font-weight: bold; fill: #efdeb1; pointer-events: none; user-select: none; }

#bbBottomPanel {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 25;
    background: rgba(58,36,19,0.94); border-top: 2px solid #b88742; padding: 12px;
    max-height: 46vh; overflow-y: auto; box-shadow: 0 -6px 14px rgba(0,0,0,0.3);
}
#bbBottomPanel h2 { font-size: 13px; margin: 0 0 8px 0; color: #f5c469; }
#bbBudgetLine { font-size: 12px; margin-bottom: 8px; }
#bbBudgetLine.bb-over { color: #e74c3c; font-weight: bold; }
#bbRosterList { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; max-height: 160px; overflow-y: auto; }
.bb-rosterCard {
    width: 78px; background: #2b1a0e; border: 2px solid #6b4a26; border-radius: 8px; padding: 6px 4px;
    text-align: center; cursor: pointer; font-size: 10px;
}
.bb-rosterCard.bb-picked { border-color: #2ecc71; background: #1f3a1f; }
.bb-rosterCard.bb-selecting { border-color: #f1c40f; background: #4a3a12; box-shadow: 0 0 10px rgba(241,196,15,0.7); transform: scale(1.05); }
.bb-rosterCard .bb-rcVisual { width: 40px; height: 40px; margin: 0 auto; border-radius: 50%; overflow: hidden; background: #efdeb1; }
.bb-rosterCard .bb-rcVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-rosterCard .bb-rcName { font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.bb-rosterCard .bb-rcStats { font-size: 8px; color: #b88742; margin-top: 2px; }
.bb-rosterCard .bb-rcTotal { font-size: 9px; color: #f1c40f; font-weight: bold; margin-top: 2px; }
#bbPlaceHint { font-size: 11px; color: #b88742; margin-bottom: 8px; line-height: 1.5; }
.bb-actionBtn {
    background: #b88742; color: #efdeb1; border: none; border-radius: 6px; padding: 10px 20px;
    font-weight: bold; font-size: 13px; cursor: pointer; margin-right: 8px; margin-top: 4px;
}
.bb-actionBtn:disabled { background: #6b4a26; color: #8a7250; cursor: not-allowed; }
.bb-actionBtn.bb-secondary { background: #5a3d20; }
#bbBattleLog {
    background: #1c1108; border: 1px solid #6b4a26; border-radius: 6px; padding: 8px; font-size: 11px;
    max-height: 90px; overflow-y: auto; margin-bottom: 8px; line-height: 1.6; white-space: pre-wrap;
}
#bbResultOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9010;
}
#bbResultBox { background: #efdeb1; color: #420000; border-radius: 12px; padding: 30px 40px; text-align: center; }
#bbResultBox h2 { font-size: 24px; margin: 0 0 12px 0; }

/* 盤面の駒をタップした時に出す簡易ステータスカード（配置フェーズ・戦闘フェーズ共通） */
#bbUnitDetailOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 9020;
}
#bbUnitDetailBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px 26px; text-align: center; width: 220px; }
#bbUnitDetailVisual { width: 84px; height: 84px; margin: 0 auto 8px; border-radius: 50%; overflow: hidden; background: #fff; border: 3px solid #b88742; }
#bbUnitDetailVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-unitDetailTeam { display: inline-block; font-size: 10px; padding: 2px 10px; border-radius: 10px; margin-bottom: 6px; background: #555; }
.bb-unitDetailTeam.bb-team-player { background: #2980b9; }
.bb-unitDetailTeam.bb-team-enemy { background: #c0392b; }
#bbUnitDetailName { font-size: 15px; margin: 0 0 10px 0; color: #efdeb1; }
#bbUnitDetailStats { font-size: 12px; text-align: left; }
.bb-udStatRow { display: flex; justify-content: space-between; padding: 3px 4px; border-bottom: 1px solid rgba(107,74,38,0.6); }
.bb-udStatRow.bb-udStatTotal { border-bottom: none; margin-top: 4px; font-weight: bold; color: #f1c40f; }

/* カレー準備画面：ボードバトルを開いた時の入口。登録済みロースターの一覧と
   カレー登録／戦闘開始／ヘルプの3ボタンだけを見せ、盤面はまだ表示しない。 */
#bbPrepPanel {
    position: absolute; inset: 0; z-index: 15; background: #2b1a0e; padding: 70px 14px 14px;
    overflow-y: auto; display: none;
}
#bbPrepPanel h2 { font-size: 14px; margin: 0 0 10px 0; color: #f5c469; }
#bbPrepCountLine { font-size: 11px; color: #b88742; margin-bottom: 8px; }
#bbPrepRosterList { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.bb-prepBtnRow { display: flex; flex-wrap: wrap; gap: 4px; }

/* カレー登録：カレーストックからの選択ピッカー */
#bbRegisterPickerOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbRegisterPickerBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 280px; max-height: 80vh; }
#bbRegisterPickerBox h3 { font-size: 15px; margin: 0 0 10px 0; color: #efdeb1; }
#bbRegisterPickerList { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-height: 50vh; overflow-y: auto; margin-bottom: 12px; }

/* 登録済みカレーの詳細（装備・名前変更・登録削除） */
#bbRegDetailOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbRegDetailCarouselRow { display: flex; align-items: center; gap: 6px; max-width: 100%; }
#bbRegDetailBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px 22px; text-align: center; width: 250px; max-height: 82vh; overflow-y: auto; touch-action: pan-y; }
#bbRegDetailVisual { width: 84px; height: 84px; margin: 0 auto 8px; border-radius: 50%; overflow: hidden; background: #fff; border: 3px solid #b88742; }
#bbRegDetailVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
#bbRegDetailNameInput {
    width: 100%; box-sizing: border-box; background: #1c1108; border: 1px solid #6b4a26; color: #efdeb1;
    border-radius: 6px; padding: 6px 8px; font-size: 13px; text-align: center; margin-bottom: 10px;
}
.bb-regEquipSectionLabel { font-size: 11px; color: #b88742; margin: 10px 0 4px; text-align: left; }
.bb-regEquipOptionList { display: flex; flex-direction: column; gap: 6px; max-height: 130px; overflow-y: auto; }
.bb-equipOption { cursor: pointer; padding: 8px 10px; border-radius: 6px; border: 2px solid #6b4a26; background: #1c1108; text-align: left; }
.bb-equipOption.bb-equipOptionSel { border-color: #f1c40f; background: #4a3a12; }
.bb-equipOptionName { font-weight: bold; font-size: 12px; color: #efdeb1; }
.bb-equipOptionDesc { font-size: 10px; color: #b88742; margin-top: 2px; }
.bb-regDetailBtnRow { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.bb-actionBtn.bb-danger { background: #7a2e2e; }
.bb-actionBtn.bb-small { padding: 6px 12px; font-size: 11px; margin: 0; }
/* 詳細カード左右の「次/前のカレー」プレビュー。タップで移動、本体はスワイプでも移動できる。 */
.bb-regNavCard {
    width: 50px; height: 70px; border-radius: 8px; background: rgba(43,26,14,0.85); border: 2px solid #6b4a26;
    cursor: pointer; opacity: 0.65; overflow: hidden; display: flex; flex-direction: column; align-items: center;
    justify-content: center; flex-shrink: 0; visibility: hidden;
}
.bb-regNavCard img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.bb-regNavCard .bb-regNavCardName { font-size: 8px; color: #efdeb1; margin-top: 2px; max-width: 44px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 「カレーボードバトルとは？」ヘルプ */
#bbHelpOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbHelpBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: left; width: 280px; max-height: 80vh; overflow-y: auto; }
#bbHelpBox h3 { font-size: 15px; margin: 0 0 10px 0; color: #efdeb1; text-align: center; }
#bbHelpText { font-size: 12px; line-height: 1.7; color: #efdeb1; margin-bottom: 14px; }

/* 対戦相手（敵AIタイプ）の選択 */
#bbOpponentSelectOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbOpponentSelectBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 260px; }
#bbOpponentSelectBox h3 { font-size: 15px; margin: 0 0 12px 0; color: #efdeb1; }
#bbOpponentSelectBox .bb-equipOption { margin-bottom: 8px; }

/* 盤面バトル中に起動する本編の戦闘画面：咖喱図書館用の背景（applyBookBattleLiftが敷く
   currylibrary_bg.png）ではなく、盤面（#bbRoot）がうっすら透けて見える半透明オーバーレイにする。
   story.js側の #battleArena.book-battle-lift ルールは、咖喱図書館を開いたタイミングで
   後から<style>が追加されるため、CSS挿入順に頼ると負けることがある。挿入順に関係なく必ず
   優先されるよう、book-battle-lift自体も含めて2クラス指定にし、詳細度そのものを上回らせる。 */
#battleArena.book-battle-lift.bb-arena-overlay {
    background: rgba(20,12,6,0.55) !important;
}
.battle-stage.bb-battle-bg {
    background: rgba(10,10,10,0.32) !important;
    border: 1px solid rgba(241,196,15,0.25) !important;
    box-shadow: 0 20px 50px rgba(0,0,0,0.4) !important;
}
/* 戦闘中は盤面に触れられないよう、画面全体を覆う黒いブロック用オーバーレイを敷く。
   #bbRoot（z-index:9000）より前面、本編の戦闘画面（book-battle-liftでz-index:10050）より
   背面に置くことで、戦闘カード幅（max-width:500px）の外側（左右の余白）も含めて
   画面全体のタップを塞ぐ。カード自体は#battleArenaが最前面のまま表示される。 */
#bbBattleBlockOverlay {
    position: fixed; inset: 0; z-index: 9500; background: rgba(0,0,0,0.45); display: none;
}
/* 盤面パン・ズームの自動追従（行動順が来た駒をセンターへ）だけ滑らかにアニメーションさせる。
   ユーザー自身のドラッグ・ピンチ操作中はこのクラスを付けない＝指の動きに1:1で追従させる。 */

#bbLauncherBtn {
    position: fixed; right: 14px; bottom: 88px; z-index: 8000; display: none; align-items: center; gap: 6px;
    background: #b88742; color: #efdeb1; border: none; border-radius: 24px;
    padding: 10px 16px; font-size: 13px; font-weight: bold; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}
`;

// ------------------------------------------------------------
// 1. 盤面トポロジー
//    将棋・チェスと同じ9×9の正方形グリッド（全81マス）。
//    移動は上下左右の隣接マスのみで、斜めのつながりは一切作らない
//    （bbBuildEdgesが縦横4方向の辺しか張らないため、経路探索は自動的に
//    「斜め移動不可」になる）。
//    旗は「王将の位置」＝各陣営の一番奥の行・中央の列（列4）に置く。
// ------------------------------------------------------------
const BB_GRID_SIZE = 9; // 9×9
const BB_ROW_TOP = 0;
const BB_ROW_BOTTOM = BB_GRID_SIZE - 1; // 8
const BB_FLAG_COL = Math.floor(BB_GRID_SIZE / 2); // 4（王将の列＝中央）
const BB_ENEMY_DEPLOY_ROWS = [0, 1];  // 敵陣＝上から2行（敵旗の行そのものも含む）
const BB_PLAYER_DEPLOY_ROWS = [7, 8]; // 自陣＝下から2行（自陣旗の行そのものも含む）

const BB_BOARD_WIDTH = 600;
const BB_ROW_Y_TOP = 44;
const BB_ROW_Y_GAP = 64;
const BB_COL_X = Array.from({ length: BB_GRID_SIZE }, (_, i) => 44 + i * 64); // 9列のx座標（列4が中央＝旗の列）
const BB_NODE_R = 24;   // 駒（ポートレート）の半径・毒/岩/水などの描画基準に使用
const BB_NODE_HALF = 28; // マス（四角）の半辺の長さ＝1辺56pxの正方形

// 特殊マスの地形種別。null＝通常マス。
const BB_TERRAIN_ROCK = 'rock';   // 岩マス：わんぱくカレーのみ壊して通過できる（壊すと通常マス化）
const BB_TERRAIN_WATER = 'water'; // 水マス：海の幸カレーのみ通過・停止できる
const BB_TERRAIN_POISON = 'poison'; // 毒マス：通過・停止で最大HP20%ダメージ（毒系カレーは無効）
const BB_TERRAIN_LABEL = { rock: '岩', water: '水', poison: '毒' }; // 画像未整備の間は漢字1文字で表示
const BB_SPECIAL_TILE_COUNT = 5; // 各特殊マスの初期配置数

const BB_STAT_BUDGET = 3000;
const BB_MAX_UNITS = 5;

let bbNodes = [];   // {id,row,col,x,y,neighbors:[id...],terrain:null|'rock'|'water'|'poison'}
let bbNodesById = {};

function bbBuildBoard() {
    bbNodes = [];
    let id = 0;
    for (let row = 0; row < BB_GRID_SIZE; row++) {
        for (let col = 0; col < BB_GRID_SIZE; col++) {
            bbNodes.push({
                id: id, row: row, col: col,
                x: BB_COL_X[col], y: BB_ROW_Y_TOP + row * BB_ROW_Y_GAP,
                neighbors: [], terrain: null
            });
            id++;
        }
    }
    bbNodesById = {};
    bbNodes.forEach(n => { bbNodesById[n.id] = n; });
    bbBuildEdges();
}

function bbFindNode(row, col) {
    if (row < 0 || row >= BB_GRID_SIZE || col < 0 || col >= BB_GRID_SIZE) return null;
    return bbNodesById[row * BB_GRID_SIZE + col] || null;
}

function bbBuildEdges() {
    const connect = (a, b) => {
        if (!a || !b) return;
        if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
        if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
    };
    bbNodes.forEach(n => {
        // 上下左右の4方向のみ（斜めのつながりは作らない＝斜め移動不可）
        connect(n, bbFindNode(n.row - 1, n.col));
        connect(n, bbFindNode(n.row + 1, n.col));
        connect(n, bbFindNode(n.row, n.col - 1));
        connect(n, bbFindNode(n.row, n.col + 1));
    });
}

function bbGetFlagNodeId(team) {
    const row = (team === 'player') ? BB_ROW_BOTTOM : BB_ROW_TOP;
    const n = bbFindNode(row, BB_FLAG_COL);
    return n ? n.id : null;
}

// 旗のあるマスかどうか（各陣営とも中央列×一番奥の行の1マスのみ）。
// カレーを配置できない・特殊マスを重ねて生成しない等、複数箇所から共通で使う。
function bbIsFlagNode(n) {
    return !!n && n.col === BB_FLAG_COL && (n.row === BB_ROW_TOP || n.row === BB_ROW_BOTTOM);
}

function bbGetDeployRows(team) {
    return team === 'player' ? BB_PLAYER_DEPLOY_ROWS : BB_ENEMY_DEPLOY_ROWS;
}

// ------------------------------------------------------------
// 1.5 特殊マス（岩・水・毒）
//    配置フェーズ開始時（bbEnterPlacementPhase）に、旗マス・配置マスを除いた
//    中間エリアへランダムに5マスずつ配置する。岩・水は通常のカレーにとって
//    通行不可の地形なので、配置後に必ず「自陣旗→敵旗」の通行可能な経路が
//    残っていることを確認し、駄目なら配置をやり直す。
// ------------------------------------------------------------
function bbIsTerrainBlockedForNormalCurry(node) {
    return node.terrain === BB_TERRAIN_ROCK || node.terrain === BB_TERRAIN_WATER;
}

function bbCanBreakRock(unit) { return !!(unit.raw && unit.raw.isWanpaku); }
function bbCanCrossWater(unit) { return !!(unit.raw && unit.raw.isSeafood); }
function bbIsPoisonImmune(unit) { return !!(unit.raw && (unit.raw.isPoison || unit.raw.isPoisonApple)); }

function bbGetSpecialTileCandidateNodes() {
    // 旗の行・配置エリアの行は除外し、中間エリアだけを特殊マス配置の対象にする
    // （旗の上や配置直後のマスが岩・水で塞がれる事故を防ぐため）。
    const excludedRows = new Set([BB_ROW_TOP, BB_ROW_BOTTOM].concat(BB_ENEMY_DEPLOY_ROWS, BB_PLAYER_DEPLOY_ROWS));
    return bbNodes.filter(n => !excludedRows.has(n.row));
}

// 通常のカレー（岩・水を通れない）基準で、自陣旗から敵旗まで到達できるかを確認する。
// 毒マスは通行自体は妨げないのでここでは無視してよい。
function bbCheckFlagsConnected() {
    const startId = bbGetFlagNodeId('player');
    const goalId = bbGetFlagNodeId('enemy');
    if (startId == null || goalId == null) return false;
    const visited = new Set([startId]);
    let frontier = [startId];
    while (frontier.length > 0) {
        const next = [];
        frontier.forEach(nid => {
            bbNodesById[nid].neighbors.forEach(nnid => {
                if (visited.has(nnid)) return;
                const n = bbNodesById[nnid];
                if (bbIsTerrainBlockedForNormalCurry(n)) return;
                visited.add(nnid);
                next.push(nnid);
            });
        });
        frontier = next;
    }
    return visited.has(goalId);
}

function bbGenerateSpecialTiles() {
    bbNodes.forEach(n => { n.terrain = null; });
    const candidates = bbGetSpecialTileCandidateNodes();
    const need = BB_SPECIAL_TILE_COUNT * 3;
    if (candidates.length < need) {
        console.warn('[ボードバトル] 特殊マス配置候補が不足しています。');
        return;
    }
    const applyPicks = (pool) => {
        pool.slice(0, BB_SPECIAL_TILE_COUNT).forEach(n => { n.terrain = BB_TERRAIN_ROCK; });
        pool.slice(BB_SPECIAL_TILE_COUNT, BB_SPECIAL_TILE_COUNT * 2).forEach(n => { n.terrain = BB_TERRAIN_WATER; });
        pool.slice(BB_SPECIAL_TILE_COUNT * 2, BB_SPECIAL_TILE_COUNT * 3).forEach(n => { n.terrain = BB_TERRAIN_POISON; });
    };
    const MAX_ATTEMPTS = 200;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        candidates.forEach(n => { n.terrain = null; });
        const pool = candidates.slice();
        bbShuffleArray(pool);
        applyPicks(pool);
        if (bbCheckFlagsConnected()) return;
    }
    // 200回試しても通行可能な配置が見つからない場合の保険：旗と同じ列（中央列）だけは
    // 特殊マスの対象から外し、必ず縦に抜けられる道を1本残してから配置する。
    console.warn('[ボードバトル] ランダム配置での経路確保に失敗したため、中央列を空けて再配置します。');
    candidates.forEach(n => { n.terrain = null; });
    const safeCandidates = candidates.filter(n => n.col !== BB_FLAG_COL);
    const pool2 = safeCandidates.slice();
    bbShuffleArray(pool2);
    applyPicks(pool2);
}

// ------------------------------------------------------------
// 2. カレー ↔ ユニット
//    カレー画像の判定（getCurryType/getCurryImage）は本編game.js側の
//    既存グローバル関数をそのまま呼び出す（このファイルでは再定義しない）。
// ------------------------------------------------------------
let bbUnitSeq = 1;
function bbMakeUnit(curry, team) {
    const hp = Math.max(1, curry.hp || 1);
    return {
        uid: bbUnitSeq++,
        name: curry.name || 'カレー',
        hp: hp, maxHp: hp,
        atk: curry.atk || 0, def: curry.def || 0, spd: curry.spd || 0,
        team: team,
        nodeId: null,
        raw: curry
    };
}
function bbStatTotal(c) { return (c.hp || 0) + (c.atk || 0) + (c.def || 0) + (c.spd || 0); }

// ------------------------------------------------------------
// 3. 実際のカレーストックを読み込む
//    本編と同じ実行環境で動いているため、curryStock（game.js側のグローバル）を
//    直接参照できる。localStorageの再パースは不要（常に最新の状態と一致する）。
// ------------------------------------------------------------
function bbLoadRealCurryStock() {
    try {
        return (typeof curryStock !== 'undefined' && Array.isArray(curryStock))
            ? curryStock.filter(c => !c.isDelivering && !c.__isBoardBattleTemp)
            : [];
    } catch (e) {
        console.warn('[ボードバトル] カレーストックの読み込みに失敗:', e);
        return [];
    }
}

// 何らかの理由（テスト中の中断等）でstartExternalBoardBattleが積んだ使い捨てカレーが
// curryStockに残ってしまった場合の掃除。開くたびに必ず呼ぶことで、配置フェーズの
// カレー一覧が幽霊エントリで際限なく増えていくことを防ぐ。
function bbCleanupLeakedTempCurries() {
    try {
        if (typeof curryStock === 'undefined' || !Array.isArray(curryStock)) return;
        for (let i = curryStock.length - 1; i >= 0; i--) {
            if (curryStock[i] && curryStock[i].__isBoardBattleTemp) curryStock.splice(i, 1);
        }
    } catch (e) {
        console.warn('[ボードバトル] 使い捨てカレーの掃除に失敗:', e);
    }
}

// 敵カレーの生成：宅配カレーのダミーキャラ生成（generateRandomCurryFromPool/buildCurryFromMaterials）と
// 全く同じ、本編の実際の調理ロジックをそのまま流用する。食材の組み合わせ次第で特殊カレー
// （毒・マルゲリータ・ホームラン等）も同じ条件判定でそのまま出現する。
const BB_DEBUG_RANDOM_CURRY_NAMES = ['野生のカレー', '謎のカレー', '見習いのカレー', '放浪カレー', '名もなきカレー', '荒野のカレー', '古の一皿', '通りすがりのカレー'];
function bbGenerateDebugCurry(targetTotalHint) {
    if (typeof generateRandomCurryFromPool === 'function' &&
        (typeof getHighIngredientPool === 'function' || typeof getMidIngredientPool === 'function')) {
        try {
            const pool = (typeof getHighIngredientPool === 'function') ? getHighIngredientPool()
                : getMidIngredientPool();
            if (pool && pool.length > 0) {
                // includeSpice=trueにすることでスパイスも抽選対象にし、特殊カレーが出る幅を広げる。
                return generateRandomCurryFromPool(pool, true);
            }
        } catch (e) {
            console.warn('[ボードバトル] 実際の調理ロジックでの敵カレー生成に失敗。簡易生成にフォールバックします', e);
        }
    }
    // フォールバック：本編の調理関数が見つからない場合のみ、従来の簡易ランダム生成を使う。
    const total = targetTotalHint || (300 + Math.floor(Math.random() * 300));
    const weights = [Math.random(), Math.random(), Math.random(), Math.random()];
    const wsum = weights.reduce((a, b) => a + b, 0);
    const hp = Math.max(20, Math.round(total * weights[0] / wsum));
    const atk = Math.max(10, Math.round(total * weights[1] / wsum));
    const def = Math.max(10, Math.round(total * weights[2] / wsum));
    const spd = Math.max(5, Math.round(total * weights[3] / wsum));
    const curryTypeVal = (typeof getCurryType === 'function') ? getCurryType(hp, atk, def, spd) : 'balance';
    return {
        name: BB_DEBUG_RANDOM_CURRY_NAMES[Math.floor(Math.random() * BB_DEBUG_RANDOM_CURRY_NAMES.length)],
        hp, atk, def, spd,
        curryType: curryTypeVal
    };
}
function bbGenerateDebugEnemyTeam() {
    // ステータス予算（BB_STAT_BUDGET）を超えないよう、実際の調理ロジックで1体ずつ生成しては足していく
    // （食材の組み合わせ由来のステータスは狙って割り振れないため、事前配分ではなく詰め込み式にする）。
    const team = [];
    let remaining = BB_STAT_BUDGET;
    let attempts = 0;
    while (team.length < BB_MAX_UNITS && attempts < 50 && (team.length === 0 || remaining > 150)) {
        attempts++;
        const curry = bbGenerateDebugCurry();
        const total = bbStatTotal(curry);
        if (total <= remaining || team.length === 0) {
            team.push(curry);
            remaining -= total;
        }
    }
    return team;
}
function bbGetCurryImg(curry) {
    return (typeof getCurryImage === 'function') ? getCurryImage(curry) : '';
}

// ------------------------------------------------------------
// 4. ゲーム状態
// ------------------------------------------------------------
const bbState = {
    phase: 'prep', // 'prep'（カレー準備画面） | 'placement' | 'battle' | 'result'
    playerPool: [],      // 配置候補（登録済みロースターの装備反映後ステータス）
    enemyPool: [],        // デバッグ生成された敵候補
    selectedPoolIndex: null,
    units: [],            // 盤面に配置された全ユニット（player/enemy混在。行動順は下記の通り完全に統一されたタイムラインで管理）
    activeUnit: null,
    subPhase: null,       // battleフェーズ中のプレイヤー手番のサブ状態：'move'（移動先選択）| 'action'（行動選択）
    battleLogLines: []
};

// ------------------------------------------------------------
// 3.5 登録済みカレー（ボードバトル専用ロースター）
//    ・カレーストックとは別に、ボードバトル用に「登録」したカレーだけを集めた
//      永続的な一覧を持つ。登録はカレーストックからの片道の移動（ストックからは消える）。
//    ・登録済みカレーには名前の変更・ベース/食器の個別装備ができる（本編のselectedBase/
//      selectedTableware＝全体共通の装備とは完全に独立）。
//    ・本編（game-source-work.js）のsaveGame()には含めず、このファイル専用の
//      localStorageキーで完結させる（本体には一切手を加えない、という開発方針を維持するため）。
// ------------------------------------------------------------
const BB_ROSTER_STORAGE_KEY = 'qr_board_battle_roster';
const BB_ROSTER_MAX = 20; // 登録済みカレーの上限数
let bbRegisteredRoster = [];

function bbLoadRegisteredRoster() {
    try {
        const raw = localStorage.getItem(BB_ROSTER_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        bbRegisteredRoster = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('[ボードバトル] 登録済みカレーの読み込みに失敗:', e);
        bbRegisteredRoster = [];
    }
}
function bbSaveRegisteredRoster() {
    try {
        localStorage.setItem(BB_ROSTER_STORAGE_KEY, JSON.stringify(bbRegisteredRoster));
    } catch (e) {
        console.warn('[ボードバトル] 登録済みカレーの保存に失敗:', e);
    }
}
// ベース・食器（本編のBASE_LIST/TABLEWARE_LIST）による、登録カレー1件分のステータス補正値。
function bbGetEquipBonus(statKey, entry) {
    const b = (typeof BASE_LIST !== 'undefined' && BASE_LIST[entry.equippedBase]) || {};
    const t = (typeof TABLEWARE_LIST !== 'undefined' && TABLEWARE_LIST[entry.equippedTableware]) || {};
    return (b[statKey] || 0) + (t[statKey] || 0);
}
// 登録カレー1件から、装備補正・カスタム名を反映した「実際に使うカレーオブジェクト」を作る。
// 元のraw（curryStockから移した本体）は書き換えない。特殊カレー判定に必要なmaterials/spice/
// curryType等のフィールドはrawからそのまま引き継がれるため、装備で変わるのは数値ステータスのみ。
function bbGetEffectiveCurry(entry) {
    const raw = entry.raw || {};
    return Object.assign({}, raw, {
        name: entry.customName || raw.name || 'カレー',
        hp: Math.max(1, (raw.hp || 0) + bbGetEquipBonus('hp', entry)),
        atk: Math.max(0, (raw.atk || 0) + bbGetEquipBonus('atk', entry)),
        def: Math.max(0, (raw.def || 0) + bbGetEquipBonus('def', entry)),
        spd: Math.max(1, (raw.spd || 0) + bbGetEquipBonus('spd', entry))
    });
}
// 本編のstatDisplayWithTableware()と同じ見た目（元の数値＋色付きの補正値）で、
// 登録カレー1件分の装備補正を表示するための版。本編側は全体共通のselectedBase/
// selectedTablewareを見るが、こちらは装備編集画面で選択中のentryの装備を見る。
function bbStatDisplayWithEquip(statKey, baseVal, entry) {
    const mod = bbGetEquipBonus(statKey, entry);
    if (!mod) return String(baseVal || 0);
    const color = mod > 0 ? '#2980b9' : '#e74c3c';
    const sign = mod > 0 ? '+' : '';
    return `${baseVal || 0}<span style="color:${color};">${sign}${mod}</span>`;
}

// 全オーバーレイ・パネルを一旦隠す共通処理（画面遷移のたびに、前の状態が残らないようにする）。
function bbHideAllOverlaysAndPanels() {
    ['bbResultOverlay', 'bbUnitDetailOverlay', 'bbRegisterPickerOverlay', 'bbRegDetailOverlay', 'bbHelpOverlay', 'bbOpponentSelectOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// カレーボードバトルを開いた時・「バトルボードに戻る」で戻ってきた時の初期画面＝カレー準備画面。
// （盤面はまだ表示せず、登録済みカレーの一覧と「カレー登録」「戦闘開始」だけを見せる）
function bbInit() {
    bbLoadRegisteredRoster();
    bbCleanupLeakedTempCurries();
    bbState.phase = 'prep';
    bbState.units = [];
    bbState.activeUnit = null;
    bbState.battleLogLines = [];
    bbHideAllOverlaysAndPanels();
    document.getElementById('bbPrepPanel').style.display = 'block';
    document.getElementById('bbBoardWrap').style.display = 'none';
    document.getElementById('bbBottomPanel').style.display = 'none';
    // 行動順アイコン用の帯（#bbTurnQueueBar）は戦闘フェーズ専用。準備画面では中身が空でも
    // 半透明の背景だけが残って見た目に重なってしまうため、明示的に隠しておく。
    const turnQueueBarElPrep = document.getElementById('bbTurnQueueBar');
    if (turnQueueBarElPrep) turnQueueBarElPrep.style.display = 'none';
    bbRenderPrepPanel();
}

// 準備画面の「戦闘開始」で呼ばれる：盤面を表示し、登録済みロースターを配置候補として配置フェーズへ。
function bbEnterPlacementPhase() {
    bbCleanupLeakedTempCurries();
    bbBuildBoard();
    bbGenerateSpecialTiles(); // 岩・水・毒マスをランダムに5マスずつ配置（自陣旗→敵旗の経路は必ず確保する）
    bbState.phase = 'placement';
    bbState.playerPool = bbRegisteredRoster.map(bbGetEffectiveCurry);
    bbState.enemyPool = bbGenerateDebugEnemyTeam();
    bbState.selectedPoolIndex = null;
    bbState.units = [];
    bbState.activeUnit = null;
    bbState.battleLogLines = [];
    bbHideAllOverlaysAndPanels();
    document.getElementById('bbPrepPanel').style.display = 'none';
    document.getElementById('bbBoardWrap').style.display = 'block';
    document.getElementById('bbBottomPanel').style.display = 'block';
    document.getElementById('bbPlacementPanel').style.display = 'block';
    document.getElementById('bbBattlePanel').style.display = 'none';
    document.getElementById('bbBattleLog').innerHTML = '';
    // 配置フェーズでもまだ行動順は無いので、帯は隠したまま（戦闘開始で改めて表示する）。
    const turnQueueBarElPlacement = document.getElementById('bbTurnQueueBar');
    if (turnQueueBarElPlacement) turnQueueBarElPlacement.style.display = 'none';
    bbRenderBoard();
    bbRenderPlacementPanel();
    bbFitView();
}
function bbOnPrepStartBattleClick() {
    if (bbRegisteredRoster.length === 0) {
        alert('登録済みのカレーがありません。「カレー登録」からカレーストックのカレーを登録してください。');
        return;
    }
    bbShowOpponentSelect();
}

// ------------------------------------------------------------
// 4.4 対戦相手（敵AI）の選択
//    3種類のAI行動パターンを、盤面配置に入る前に選ばせる。プレイヤー側だけでなく
//    敵チーム全員に同じ行動パターンを適用する（1体ごとに変える機能ではない）。
// ------------------------------------------------------------
let bbSelectedOpponentType = 'random';
function bbShowOpponentSelect() {
    const el = document.getElementById('bbOpponentSelectOverlay');
    if (el) el.style.display = 'flex';
}
function bbCloseOpponentSelect() {
    const el = document.getElementById('bbOpponentSelectOverlay');
    if (el) el.style.display = 'none';
}
function bbSelectOpponentType(type) {
    bbSelectedOpponentType = type;
    bbCloseOpponentSelect();
    bbEnterPlacementPhase();
}

// ------------------------------------------------------------
// 4.5. 盤面のパン・ズーム（地図アプリのように自由に動かせる）
//    #bbBoardWrapは画面全体に敷き詰められた固定領域で、ネイティブのスクロールは使わない。
//    盤面の内容（辺・ノード・駒）は<g id="bbViewportG">の中に描画し、その要素へ
//    transform: translate(x,y) scale(s) を直接適用してパン・ズームを実現する。
//    ヘッダー／行動順バー／メッセージウインドウは別レイヤー（position:absolute）で
//    常に画面上の同じ位置に固定表示され、この変形の影響を受けない。
// ------------------------------------------------------------
const BB_MIN_SCALE = 0.5, BB_MAX_SCALE = 3;
let bbView = { x: 0, y: 0, scale: 1 };
const bbPointers = new Map(); // pointerId -> {x,y}（#bbBoardWrap基準の座標）
let bbDragLast = null;   // 1本指パンの直前座標
let bbPinchLast = null;  // 2本指ピンチの直前状態 {dist,cx,cy}
let bbGestureMoved = 0;  // このジェスチャー中に動いた量（クリックか否かの判定用）

function bbBoardTotalHeight() {
    return BB_ROW_Y_TOP + (BB_GRID_SIZE - 1) * BB_ROW_Y_GAP + 60;
}

function bbSyncSvgSize(w, h) {
    const svg = document.getElementById('bbBoardSvg');
    if (!svg) return;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
}

function bbApplyView() {
    const g = document.getElementById('bbViewportG');
    if (g) g.setAttribute('transform', `translate(${bbView.x},${bbView.y}) scale(${bbView.scale})`);
}

// 行動順が回ってきた駒を画面中央へ自動的に移動させる（ズーム倍率は変えない）。
// ユーザーの手動パン・ピンチ操作とは違い、ここだけは滑らかにスクロールさせる。
// SVGのtransform属性はsetAttribute()で書き換えているため、CSSトランジション
// （transition:transform）を効かせようとしてもブラウザによっては無視される
// （駒移動アニメーションで踏んだのと同じ問題）。そのため、CSSトランジションには
// 頼らず、requestAnimationFrameで毎フレームbbView.x/yを手動で補間して
// bbApplyView()を呼び直す、確実なJSトゥイーンに置き換える。
let bbCenterAnimId = null;
function bbCancelCenterAnim() {
    if (bbCenterAnimId !== null) {
        if (typeof cancelAnimationFrame === 'function') { try { cancelAnimationFrame(bbCenterAnimId); } catch (e) {} }
        bbCenterAnimId = null;
    }
}
function bbEaseInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function bbCenterOnNode(nodeId, onComplete) {
    const node = bbNodesById[nodeId];
    const wrap = document.getElementById('bbBoardWrap');
    const g = document.getElementById('bbViewportG');
    if (!node || !wrap || !g) { if (typeof onComplete === 'function') onComplete(); return; }
    const wrapW = wrap.clientWidth || 360;
    const wrapH = wrap.clientHeight || 600;
    const targetX = wrapW / 2 - node.x * bbView.scale;
    const targetY = wrapH / 2 - node.y * bbView.scale;
    bbCancelCenterAnim();
    const startX = bbView.x, startY = bbView.y;
    const dist = Math.hypot(targetX - startX, targetY - startY);
    if (dist < 0.5) { bbView.x = targetX; bbView.y = targetY; bbApplyView(); if (typeof onComplete === 'function') onComplete(); return; }
    // 距離に応じてフレーム数を決める（60fps換算でおよそ250〜700ms相当）。
    // 実時間（Date.now）ではなくフレーム数で進行度を管理することで、
    // requestAnimationFrameが同期的に即時実行される環境（テストハーネス等）でも
    // 再帰呼び出しの回数が有限に収まり、スタックオーバーフローを避けられる。
    const totalFrames = Math.round(Math.min(42, Math.max(15, dist / 8)));
    let frame = 0;
    function step() {
        frame++;
        const t = Math.min(1, frame / totalFrames);
        const eased = bbEaseInOutQuad(t);
        bbView.x = startX + (targetX - startX) * eased;
        bbView.y = startY + (targetY - startY) * eased;
        bbApplyView();
        if (t < 1) {
            bbCenterAnimId = requestAnimationFrame(step);
        } else {
            if (typeof onComplete === 'function') onComplete();
            bbCenterAnimId = null;
        }
    }
    bbCenterAnimId = requestAnimationFrame(step);
}

// 盤面全体が画面にちょうど収まるよう、初期のパン位置・ズームを計算する（開始・リスタート時に実行）。
function bbFitView() {
    const wrap = document.getElementById('bbBoardWrap');
    if (!wrap) return;
    const wrapW = wrap.clientWidth || 360;
    const wrapH = wrap.clientHeight || 600;
    bbSyncSvgSize(wrapW, wrapH);
    const totalHeight = bbBoardTotalHeight();
    const fitScale = Math.max(BB_MIN_SCALE, Math.min(BB_MAX_SCALE,
        Math.min(wrapW / BB_BOARD_WIDTH, wrapH / totalHeight) * 0.92));
    bbView.scale = fitScale;
    bbView.x = (wrapW - BB_BOARD_WIDTH * fitScale) / 2;
    bbView.y = (wrapH - totalHeight * fitScale) / 2;
    bbApplyView();
}

function bbGetWrapPoint(evt) {
    const wrap = document.getElementById('bbBoardWrap');
    const rect = wrap.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function bbComputePinch(pts) {
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
}

function bbZoomAt(px, py, factor) {
    const newScale = Math.min(BB_MAX_SCALE, Math.max(BB_MIN_SCALE, bbView.scale * factor));
    const actualFactor = newScale / bbView.scale;
    bbView.x = px - (px - bbView.x) * actualFactor;
    bbView.y = py - (py - bbView.y) * actualFactor;
    bbView.scale = newScale;
    bbApplyView();
}

function bbOnPointerDown(evt) {
    bbCancelCenterAnim(); // ユーザーが手動で操作を始めたら自動センタリング演出は打ち切る
    const wrap = document.getElementById('bbBoardWrap');
    if (wrap.setPointerCapture) { try { wrap.setPointerCapture(evt.pointerId); } catch (e) {} }
    bbPointers.set(evt.pointerId, bbGetWrapPoint(evt));
    bbGestureMoved = 0;
    if (bbPointers.size === 1) {
        bbDragLast = bbGetWrapPoint(evt);
        bbPinchLast = null;
    } else if (bbPointers.size === 2) {
        bbPinchLast = bbComputePinch(Array.from(bbPointers.values()));
        bbDragLast = null;
    }
}
function bbOnPointerMove(evt) {
    if (!bbPointers.has(evt.pointerId)) return;
    bbPointers.set(evt.pointerId, bbGetWrapPoint(evt));
    if (bbPointers.size === 1 && bbDragLast) {
        const p = bbGetWrapPoint(evt);
        const dx = p.x - bbDragLast.x, dy = p.y - bbDragLast.y;
        bbGestureMoved += Math.hypot(dx, dy);
        bbView.x += dx; bbView.y += dy;
        bbDragLast = p;
        bbApplyView();
    } else if (bbPointers.size === 2) {
        const pts = Array.from(bbPointers.values());
        const now = bbComputePinch(pts);
        if (bbPinchLast && bbPinchLast.dist > 0) {
            bbZoomAt(now.cx, now.cy, now.dist / bbPinchLast.dist);
            bbGestureMoved += Math.abs(now.dist - bbPinchLast.dist);
        }
        bbPinchLast = now;
    }
}
function bbOnPointerUpOrCancel(evt) {
    bbPointers.delete(evt.pointerId);
    if (bbPointers.size === 1) {
        bbDragLast = Array.from(bbPointers.values())[0] || null;
        bbPinchLast = null;
    } else if (bbPointers.size === 0) {
        bbDragLast = null; bbPinchLast = null;
    }
}
function bbOnWheel(evt) {
    bbCancelCenterAnim();
    evt.preventDefault();
    const p = bbGetWrapPoint(evt);
    const factor = evt.deltaY < 0 ? 1.12 : (1 / 1.12);
    bbZoomAt(p.x, p.y, factor);
}
// パン・ピンチでそれなりに動いた後のclickは、ノードのタップ操作として扱わない
// （地図アプリで指を滑らせただけなのに、下にあった場所を誤ってタップ判定しないのと同じ）。
function bbOnBoardClickCapture(evt) {
    if (bbGestureMoved > 8) {
        evt.stopPropagation();
        evt.preventDefault();
    }
    bbGestureMoved = 0;
}

// ------------------------------------------------------------
// 5. 盤面描画
// ------------------------------------------------------------
function bbFlagMarkup(x, y, color) {
    let s = `<line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y + 14}" stroke="${color}" stroke-width="3"></line>`;
    s += `<path d="M ${x} ${y - 16} L ${x + 16} ${y - 10} L ${x} ${y - 4} Z" fill="${color}"></path>`;
    return s;
}

function bbRenderBoard() {
    const viewportG = document.getElementById('bbViewportG');
    if (!viewportG) return;
    let html = '';
    // 辺（上下左右の4方向のみ。斜めのつながりは存在しない）
    bbNodes.forEach(n => {
        n.neighbors.forEach(nid => {
            if (nid > n.id) {
                const o = bbNodesById[nid];
                html += `<line class="bb-board-edge" x1="${n.x}" y1="${n.y}" x2="${o.x}" y2="${o.y}"></line>`;
            }
        });
    });
    // ノード
    bbNodes.forEach(n => {
        // 旗は各陣営とも1マスだけ（中央列＝BB_FLAG_COLの、一番奥の行のみ）。
        const isFlag = bbIsFlagNode(n);
        // 移動アニメーション中のユニットは、通常描画では一旦隠す（浮動スプライト側で表示する）
        const unit = bbState.units.find(u => u.nodeId === n.id && !u._animating);
        const isActive = !!(bbState.activeUnit && bbState.activeUnit.nodeId === n.id && bbState.activeUnit.hp > 0 && !bbState.activeUnit._animating);
        let cls = 'bb-board-node-tile';
        if (isFlag) cls += ' bb-flag-tile';
        if (n.terrain) cls += ` bb-terrain-${n.terrain}`;
        if (unit) cls += (unit.team === 'player') ? ' bb-occupied-player' : ' bb-occupied-enemy';
        if (n.highlight === 'selectable') cls += ' bb-selectable';
        if (n.highlight === 'movable') cls += ' bb-movable';
        if (n.highlight === 'attackable') cls += ' bb-attackable';
        if (isActive) cls += ' bb-active-turn';
        html += `<g onclick="window.__bbOnNodeClick(${n.id})">`;
        if (isActive) {
            const ringHalf = BB_NODE_HALF + 4;
            html += `<rect class="bb-active-ring" x="${n.x - ringHalf}" y="${n.y - ringHalf}" width="${ringHalf * 2}" height="${ringHalf * 2}"></rect>`;
        }
        html += `<rect class="${cls}" x="${n.x - BB_NODE_HALF}" y="${n.y - BB_NODE_HALF}" width="${BB_NODE_HALF * 2}" height="${BB_NODE_HALF * 2}"></rect>`;
        if (isFlag && !unit) {
            html += bbFlagMarkup(n.x, n.y, n.row === BB_ROW_TOP ? '#e74c3c' : '#3498db');
        }
        // 特殊マスの画像は未整備のため、暫定的に漢字1文字（岩/水/毒）で示す（駒が乗っている間は隠す）。
        if (n.terrain && !unit) {
            html += `<text class="bb-terrain-label" x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central">${BB_TERRAIN_LABEL[n.terrain] || ''}</text>`;
        }
        if (unit) {
            const clipId = `bbClip${n.id}`;
            const r2 = BB_NODE_R - 4;
            html += `<defs><clipPath id="${clipId}"><circle cx="${n.x}" cy="${n.y}" r="${r2}"></circle></clipPath></defs>`;
            html += `<image href="${bbGetCurryImg(unit.raw)}" x="${n.x - r2}" y="${n.y - r2}" width="${r2 * 2}" height="${r2 * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
            const pct = Math.max(0, unit.hp / unit.maxHp);
            const barW = BB_NODE_HALF * 1.6;
            html += `<rect class="bb-board-hp-bg" x="${n.x - barW / 2}" y="${n.y + BB_NODE_HALF + 4}" width="${barW}" height="5" rx="2"></rect>`;
            html += `<rect class="bb-board-hp-fill" x="${n.x - barW / 2}" y="${n.y + BB_NODE_HALF + 4}" width="${barW * pct}" height="5" rx="2"></rect>`;
        }
        html += `</g>`;
    });
    viewportG.innerHTML = html;
}
function bbEsc(s) { return String(s == null ? '' : s); }

// ------------------------------------------------------------
// 6. 配置フェーズ
// ------------------------------------------------------------
function bbRenderPlacementPanel() {
    const list = document.getElementById('bbRosterList');
    list.innerHTML = bbState.playerPool.map((c, idx) => {
        const picked = bbState.units.some(u => u.team === 'player' && u.raw === c);
        const selecting = (bbState.selectedPoolIndex === idx);
        const cls = 'bb-rosterCard' + (picked ? ' bb-picked' : '') + (selecting ? ' bb-selecting' : '');
        return `<div class="${cls}" onclick="window.__bbOnPickPoolCurry(${idx})">
            <div class="bb-rcVisual"><img src="${bbGetCurryImg(c)}" alt=""></div>
            <div class="bb-rcName">${bbEsc(c.name || 'カレー')}</div>
            <div class="bb-rcStats">HP${c.hp||0} ATK${c.atk||0}<br>DEF${c.def||0} SPD${c.spd||0}</div>
            <div class="bb-rcTotal">合計 ${bbStatTotal(c)}</div>
        </div>`;
    }).join('') || '<div style="font-size:11px;color:#b88742;">登録済みのカレーがありません。準備画面の「カレー登録」からカレーを登録してください。</div>';
    // 今どのカレーを配置しようとしているか、ヒント文言でも分かるようにする。
    const hintEl = document.getElementById('bbPlaceHint');
    if (hintEl) {
        if (bbState.selectedPoolIndex !== null && bbState.playerPool[bbState.selectedPoolIndex]) {
            const selName = bbEsc(bbState.playerPool[bbState.selectedPoolIndex].name || 'カレー');
            hintEl.innerHTML = `「<span style="color:#f1c40f;font-weight:bold;">${selName}</span>」を配置します。盤面の緑枠のマスをタップしてください。（もう一度カードをタップで選択解除）`;
        } else {
            hintEl.textContent = '下のカレーをタップして選択 → 盤面の自陣側（青枠）マスをタップして配置します。';
        }
    }
    bbUpdateBudgetLine();
    bbHighlightDeployTiles();
    bbRenderBoard();
}

function bbUpdateBudgetLine() {
    const placed = bbState.units.filter(u => u.team === 'player');
    const total = placed.reduce((sum, u) => sum + bbStatTotal(u.raw), 0);
    const remaining = BB_STAT_BUDGET - total;
    const el = document.getElementById('bbBudgetLine');
    el.textContent = `合計ステータス: ${total} / ${BB_STAT_BUDGET}（残り${remaining}）　配置数: ${placed.length} / ${BB_MAX_UNITS}`;
    el.classList.toggle('bb-over', total > BB_STAT_BUDGET);
    document.getElementById('bbBtnStartBattle').disabled = !(placed.length > 0 && total <= BB_STAT_BUDGET);
}

function bbHighlightDeployTiles() {
    bbNodes.forEach(n => { n.highlight = null; });
    if (bbState.selectedPoolIndex !== null) {
        const deployRows = bbGetDeployRows('player');
        bbNodes.forEach(n => {
            // 旗のあるマスにはカレーを配置できない。
            if (deployRows.includes(n.row) && !bbIsFlagNode(n) && !bbState.units.some(u => u.nodeId === n.id)) {
                n.highlight = 'selectable';
            }
        });
    }
}

function bbOnPickPoolCurry(idx) {
    if (bbState.phase !== 'placement') return;
    const already = bbState.units.find(u => u.team === 'player' && u.raw === bbState.playerPool[idx]);
    if (already) {
        // 選び直し＝配置取り消し
        bbState.units = bbState.units.filter(u => u !== already);
        bbState.selectedPoolIndex = null;
        bbRenderPlacementPanel();
        return;
    }
    // 同じカードをもう一度タップした場合は選択解除（配置先を選ぶ前ならキャンセルできるように）。
    if (bbState.selectedPoolIndex === idx) {
        bbState.selectedPoolIndex = null;
        bbRenderPlacementPanel();
        return;
    }
    const placed = bbState.units.filter(u => u.team === 'player');
    if (placed.length >= BB_MAX_UNITS) {
        alert('配置できるのは最大5体までです。');
        return;
    }
    bbState.selectedPoolIndex = idx;
    bbRenderPlacementPanel();
}

function bbOnNodeClick(nodeId) {
    const node = bbNodesById[nodeId];
    if (bbState.phase === 'placement') {
        if (bbState.selectedPoolIndex !== null && node.highlight === 'selectable') {
            const curry = bbState.playerPool[bbState.selectedPoolIndex];
            const total = bbState.units.filter(u => u.team === 'player').reduce((s, u) => s + bbStatTotal(u.raw), 0) + bbStatTotal(curry);
            if (total > BB_STAT_BUDGET) {
                alert(`ステータス合計が${BB_STAT_BUDGET}を超えるため配置できません。`);
                return;
            }
            const unit = bbMakeUnit(curry, 'player');
            unit.nodeId = nodeId;
            bbState.units.push(unit);
            bbState.selectedPoolIndex = null;
            bbRenderPlacementPanel();
            return;
        }
        // 配置先を選ぶ操作でなければ、既に置いてある駒をタップした時に詳細を見せる
        const placedUnit = bbState.units.find(u => u.nodeId === nodeId);
        if (placedUnit) bbShowUnitDetail(placedUnit);
        return;
    }
    if (bbState.phase === 'battle') {
        bbOnBattleNodeClick(nodeId);
    }
}

function bbOnRegenerateEnemyClick() {
    bbState.enemyPool = bbGenerateDebugEnemyTeam();
    bbAppendLog('敵編成を再生成しました（デバッグ）。');
}

function bbOnStartBattleClick() {
    // 敵チームを自動配置（敵配置マスにランダムに割り当て。旗のあるマスは除外）
    const enemyDeployNodes = bbNodes.filter(n => bbGetDeployRows('enemy').includes(n.row) && !bbIsFlagNode(n));
    bbShuffleArray(enemyDeployNodes);
    let idx = 0;
    bbState.enemyPool.slice(0, BB_MAX_UNITS).forEach(curry => {
        if (idx >= enemyDeployNodes.length) return;
        const unit = bbMakeUnit(curry, 'enemy');
        unit.nodeId = enemyDeployNodes[idx].id;
        bbState.units.push(unit);
        idx++;
    });
    bbNodes.forEach(n => { n.highlight = null; });
    bbState.phase = 'battle';
    bbRoundQueue = []; // 新しい戦闘の開始時は行動順キューをリセットする（前回の戦闘の残りを引き継がない）
    document.getElementById('bbPlacementPanel').style.display = 'none';
    document.getElementById('bbBattlePanel').style.display = 'block';
    // ここから行動順アイコンの帯を使うので表示に戻す（準備・配置フェーズでは隠していた）。
    const turnQueueBarElBattle = document.getElementById('bbTurnQueueBar');
    if (turnQueueBarElBattle) turnQueueBarElBattle.style.display = 'flex';
    bbRenderBoard();
    bbAppendLog('戦闘開始！');
    bbScheduleNextTurn();
}
function bbShuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }

// ------------------------------------------------------------
// 7. 行動順エンジン（周回制）
//    待ち時間（ディレイ）の概念は廃止。敵味方の区別なく、生存中の全駒を
//    SPDの高い順に並べた「1周分」の行動リストを作り、先頭から順に1体ずつ
//    行動させる。1周＝生存者全員が必ず1回ずつ行動するため、行動回数は
//    全カレー共通（SPDが低くても行動が飛ばされることはない）。
//    同SPDの駒が複数いる場合は、周ごとにランダムな順序にする。
//    ★敵味方の区別は一切なく、bbState.units全員（プレイヤー・敵混在）を同じ
//    1本のタイムラインで並べているため、「敵ターン／味方ターン」という
//    フェーズ分けそのものが存在しません（bbPickNextActorが唯一の判定ロジック）。
// ------------------------------------------------------------
let bbRoundQueue = []; // 今の周でまだ行動していない駒（先頭が次の行動者）

function bbPickNextActor() {
    while (bbRoundQueue.length > 0 && bbRoundQueue[0].hp <= 0) bbRoundQueue.shift(); // 倒れた駒は読み飛ばす
    if (bbRoundQueue.length === 0) {
        const alive = bbState.units.filter(u => u.hp > 0); // ← teamによる絞り込みは行わない＝敵味方混在の1本の周回
        if (alive.length === 0) return null;
        const shuffled = alive.slice();
        bbShuffleArray(shuffled); // 同SPDの並び順をランダム化してから、SPD降順で安定ソート
        shuffled.sort((a, b) => b.spd - a.spd);
        bbRoundQueue = shuffled;
    }
    return bbRoundQueue.shift() || null;
}

function bbScheduleNextTurn() {
    if (bbState.phase !== 'battle') return;
    const winner = bbCheckWinCondition();
    if (winner) { bbEndBattle(winner); return; }
    const actor = bbPickNextActor();
    if (!actor) return;
    bbState.activeUnit = actor;
    bbState.subPhase = (actor.team === 'player') ? 'move' : null;
    bbRenderTurnQueuePreview();
    bbRenderBoard(); // ← アクティブな駒のノードを光らせるため再描画
    if (actor.team === 'player') {
        bbCenterOnNode(actor.nodeId); // 行動順が回ってきた駒を画面中央へ自動的に移動
        bbHighlightMovableTiles(actor);
        bbSetBattleStatus(`${actor.name} の番です。移動先のマスをタップ（移動しないなら自分のマスをタップ）。`);
    } else {
        bbSetBattleStatus(`${actor.name}（敵）が行動中…`);
        // 敵の駒はセンタリングのスクロールが完全に終わってから、さらに一呼吸置いて
        // 行動を開始する（スクロール中／直後にいきなり動き出すと忙しなく見えるため）。
        bbCenterOnNode(actor.nodeId, () => {
            setTimeout(() => { bbPerformEnemyTurn(actor); }, 450);
        });
    }
}

function bbRenderTurnQueuePreview() {
    // 表示専用の簡易プレビュー：現在の行動者→今の周の残りキュー→次の周（生存者をSPD降順）
    // の順に並べて見せる（敵味方を分けず、同じ1本のタイムラインとしてそのまま並べる）。
    const bar = document.getElementById('bbTurnQueueBar');
    const alive = bbState.units.filter(u => u.hp > 0);
    const rest = bbRoundQueue.filter(u => u.hp > 0);
    const nextRoundOrder = alive.slice().sort((a, b) => b.spd - a.spd);
    const order = [bbState.activeUnit].concat(rest, nextRoundOrder).filter(Boolean).slice(0, 8);
    bar.innerHTML = order.map((u, i) => {
        const cls = `bb-turnIcon bb-team-${u.team}${i === 0 ? ' bb-current' : ''}`;
        return `<div class="${cls}" title="${bbEsc(u.name)}"><img src="${bbGetCurryImg(u.raw)}" alt=""></div>`;
    }).join('');
}

// ------------------------------------------------------------
// 8. 移動・戦闘
// ------------------------------------------------------------
// SPDに応じた移動可能マス数：100未満は1マス、100〜199は2マス、200〜299は3マス…
// （100ごとに1マスずつ増える。上限なし）。
function bbGetMoveRange(spd) {
    return Math.floor(Math.max(0, spd || 0) / 100) + 1;
}

// 直近のbbGetMovableNodeIds呼び出し結果から経路を復元するためのマップ（nodeId→そこへ来る直前のnodeId）。
// 手番ごとに「移動可能マスの算出」→「その中から1マス選んで移動」の順で必ず呼ばれるため、
// 同じ手番の中でだけ有効なキャッシュとして扱う。
let bbLastMoveParent = null;

// 移動先として到達できるマスの集合（Set<nodeId>）を返す。
// ・他の駒（敵味方問わず）がいるマスには進入できない＝到達可能マスに含めない
//   （「敵駒がいるマスは味方駒と同じで移動不可」。攻撃は移動後の別アクションで行う）。
// ・岩マスは誰であっても進入も通過もできない（わんぱくカレーの岩破壊は移動中には効かない。
//   隣接する岩を「攻撃」で破壊できる仕様は別途bbGetAdjacentActionTargetsで扱う）。
// ・水マスは海の幸カレー以外、進入も通過もできない（海の幸カレーにとっては無いものとして扱う）。
// ・毒マスは誰でも通過・停止できるが、同じ歩数で同じマスへ到達できる経路が複数ある場合は、
//   毒マスを通る回数がより少ない経路を優先する（行動時に移動先を決めた際の移動順の話であり、
//   遠回りしてまで毒マスそのものを避けるという意味ではない＝目的地は歩数最短のまま変えない）。
function bbGetMovableNodeIds(unit) {
    const maxSteps = bbGetMoveRange(unit.spd);
    const startId = unit.nodeId;
    const poisonImmune = bbIsPoisonImmune(unit);
    const bestPoisonCount = new Map([[startId, 0]]); // 確定済み（最短歩数で到達済み）のマスの、そこまでの最小毒通過回数
    const parent = new Map();
    const result = new Set();
    let frontier = [startId];
    for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
        const arrivedThisStep = new Map(); // このstep（＝歩数）で新たに到達できるマスごとの、最良（毒が最少）の毒通過回数
        frontier.forEach(nid => {
            const curPoison = bestPoisonCount.get(nid) || 0;
            bbNodesById[nid].neighbors.forEach(nnid => {
                if (bestPoisonCount.has(nnid)) return; // より少ない歩数で既に確定済みのマスは対象外（歩数が最短のものを優先）
                const targetNode = bbNodesById[nnid];
                if (targetNode.terrain === BB_TERRAIN_ROCK) return; // 岩：誰も進入・通過できない
                if (targetNode.terrain === BB_TERRAIN_WATER && !bbCanCrossWater(unit)) return; // 水：海の幸以外は不可
                const occupant = bbState.units.find(u => u.nodeId === nnid && u.hp > 0);
                if (occupant) return; // 敵味方問わず、駒がいるマスには進入も通過もできない
                const addPoison = (!poisonImmune && targetNode.terrain === BB_TERRAIN_POISON) ? 1 : 0;
                const candidatePoison = curPoison + addPoison;
                const existing = arrivedThisStep.get(nnid);
                if (existing === undefined || candidatePoison < existing) {
                    arrivedThisStep.set(nnid, candidatePoison);
                    parent.set(nnid, nid); // 同じ歩数の複数経路のうち、より毒の少ない経路の親で上書きする
                }
            });
        });
        const nextFrontier = [];
        arrivedThisStep.forEach((poisonCount, nid) => {
            bestPoisonCount.set(nid, poisonCount);
            result.add(nid);
            nextFrontier.push(nid);
        });
        frontier = nextFrontier;
    }
    bbLastMoveParent = parent;
    return result;
}

// bbLastMoveParent（直近のbbGetMovableNodeIds呼び出し結果）から、出発地点を含まない
// 「通過した順のnodeId配列（最後の要素が最終目的地）」を復元する。
function bbReconstructMovePath(unit, destNodeId) {
    const path = [];
    let cur = destNodeId;
    const guard = new Set();
    while (cur !== undefined && cur !== null && cur !== unit.nodeId && !guard.has(cur)) {
        guard.add(cur);
        path.unshift(cur);
        cur = bbLastMoveParent ? bbLastMoveParent.get(cur) : undefined;
    }
    return path;
}

function bbHighlightMovableTiles(unit) {
    bbNodes.forEach(n => { n.highlight = null; });
    bbGetMovableNodeIds(unit).forEach(nid => { bbNodesById[nid].highlight = 'movable'; });
    bbRenderBoard();
}

function bbGetMovableNeighbors(unit) {
    return Array.from(bbGetMovableNodeIds(unit));
}

function bbOnBattleNodeClick(nodeId) {
    const actor = bbState.activeUnit;
    const node = bbNodesById[nodeId];
    if (actor && actor.team === 'player' && actor.hp > 0) {
        if (bbState.subPhase === 'move') {
            // 自分が今いるマスをもう一度タップ＝移動しない（その場から行動選択フェーズへ）。
            if (nodeId === actor.nodeId) { bbSkipMoveToActionPhase(actor); return; }
            // 移動できるマスをタップした場合（敵駒がいるマスはそもそも移動可能マスに含まれない）。
            if (node.highlight === 'movable') { bbMoveUnitTo(actor, nodeId); return; }
        } else if (bbState.subPhase === 'action') {
            // 行動選択フェーズ中に自分のマスをタップ＝何も行動しない。
            if (nodeId === actor.nodeId) { bbSkipActionEndTurn(actor); return; }
            // 攻撃対象（隣接する敵駒・岩）をタップした場合。
            if (node.highlight === 'attackable') { bbOnPickActionTarget(actor, nodeId); return; }
        }
    }
    // それ以外（相手の番中や、対象ではないマス・駒をタップした場合）は詳細表示のみ行う。
    const unit = bbState.units.find(u => u.nodeId === nodeId && u.hp > 0);
    if (unit) bbShowUnitDetail(unit);
}

// ------------------------------------------------------------
// 移動スライドアニメーション
//    bbRenderBoard()は毎回SVGを丸ごと作り直すため、そのままではDOM要素が毎回
//    作り直されてしまいCSSトランジションが効かない。そこで移動中だけは対象
//    ユニットを通常描画から隠し（bbRenderBoard側の!u._animating条件）、代わりに
//    同じSVG座標系の上に浮動スプライトを重ねる。x/y/cx/cy等のSVG座標属性を
//    直接CSSトランジションさせるのはブラウザによって効かないことがあるため、
//    <g>でラップしてCSSの transform:translate() をトランジションさせる
//    （transformは各ブラウザで最も確実にアニメーションする）。
//    盤面が上下左右のみのマス目になったため、移動先が斜め位置でも最短距離を
//    直線で突っ切らせず、実際に通った経路（path＝bbReconstructMovePathの結果）を
//    1マスずつ順番にスライドさせる（縦→横、のように必ずマス目に沿って進む）。
// ------------------------------------------------------------
const BB_MOVE_ANIM_MS = 380; // 経路全体のおおよその目安（1マスあたりの時間はマス数で割って決める）
function bbAnimateUnitMove(unit, fromNodeId, path, onComplete) {
    const fromNode = bbNodesById[fromNodeId];
    const steps = (path || []).map(id => bbNodesById[id]).filter(Boolean);
    if (!fromNode || steps.length === 0) { onComplete(); return; }
    // 盤面のパン・ズーム変形を一緒に受けるよう、浮動スプライトは#bbViewportGの中に追加する
    // （#bbBoardSvg直下に置くと変形が反映されず、パン・ズーム後にずれた位置へ移動してしまう）。
    const viewportG = document.getElementById('bbViewportG');
    const ns = 'http://www.w3.org/2000/svg';
    const r2 = BB_NODE_R - 4;

    unit._animating = true;
    bbRenderBoard();

    const clipId = `bbAnimClip${unit.uid}_${Date.now()}`;
    const defs = document.createElementNS(ns, 'defs');
    const clipPath = document.createElementNS(ns, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS(ns, 'circle');
    clipCircle.setAttribute('cx', fromNode.x);
    clipCircle.setAttribute('cy', fromNode.y);
    clipCircle.setAttribute('r', r2);
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);
    viewportG.appendChild(defs);

    const g = document.createElementNS(ns, 'g');
    g.style.transform = 'translate(0px, 0px)';

    const img = document.createElementNS(ns, 'image');
    img.setAttribute('href', bbGetCurryImg(unit.raw));
    img.setAttribute('x', fromNode.x - r2);
    img.setAttribute('y', fromNode.y - r2);
    img.setAttribute('width', r2 * 2);
    img.setAttribute('height', r2 * 2);
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('clip-path', `url(#${clipId})`);
    g.appendChild(img);
    viewportG.appendChild(g);

    // 1マスあたりの区間時間（マス数が多いほど短くし、全体としてはBB_MOVE_ANIM_MS前後に収める）。
    const segMs = Math.max(90, Math.min(160, Math.round(BB_MOVE_ANIM_MS / steps.length)));
    let idx = 0;
    function runSegment() {
        if (idx >= steps.length) {
            if (viewportG.contains(g)) viewportG.removeChild(g);
            if (viewportG.contains(defs)) viewportG.removeChild(defs);
            unit._animating = false;
            onComplete();
            return;
        }
        const target = steps[idx];
        idx++;
        const dx = target.x - fromNode.x;
        const dy = target.y - fromNode.y;
        g.style.transition = `transform ${segMs}ms linear`;
        requestAnimationFrame(() => {
            g.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        setTimeout(runSegment, segMs);
    }
    // 初期状態（translate(0,0)）が実際に描画されてから動かし始めないとトランジションが
    // 発火しないため、強制リフロー＋1フレーム待ってから最初の区間を開始する。
    requestAnimationFrame(() => {
        void g.getBoundingClientRect();
        runSegment();
    });
}

// 移動経路（bbReconstructMovePathで得た、出発地点を含まないnodeId配列）を順にたどり、
// 毒マスのダメージを適用する。毒ダメージで力尽きた場合はtrueを返す
// （その場合、呼び出し側は移動後アクションフェーズなど後続の処理を行わない）。
// ※岩マスは移動中は誰も通行できないため（bbGetMovableNodeIdsで除外済み）、ここでは扱わない。
//   岩の破壊は移動後の「攻撃」アクション（bbExecuteAction）でのみ行う。
function bbApplyTerrainEffectsAlongPath(unit, path) {
    for (let i = 0; i < path.length; i++) {
        const node = bbNodesById[path[i]];
        if (!node) continue;
        if (node.terrain === BB_TERRAIN_POISON && !bbIsPoisonImmune(unit)) {
            const dmg = Math.max(1, Math.round(unit.maxHp * 0.2));
            unit.hp = Math.max(0, unit.hp - dmg);
            bbAppendLog(`${unit.name} は毒マスで${dmg}ダメージを受けた！（残HP ${unit.hp}/${unit.maxHp}）`);
            if (unit.hp <= 0) {
                bbAppendLog(`${unit.name} は毒で力尽きた。`);
                bbState.units = bbState.units.filter(u => u !== unit);
                return true;
            }
        }
    }
    return false;
}

// 移動先のマスには（bbGetMovableNodeIdsが既に除外しているため）敵味方どちらの駒もいない。
// 移動が終わったら、そのまま移動後の行動選択フェーズ（bbEnterActionPhase）へ進む。
function bbMoveUnitTo(unit, nodeId) {
    const fromNodeId = unit.nodeId;
    const movePath = bbReconstructMovePath(unit, nodeId); // 毒ダメージ判定に使う経路（出発地点は含まない）
    bbNodes.forEach(n => { n.highlight = null; });
    bbAnimateUnitMove(unit, fromNodeId, movePath, function () {
        unit.nodeId = nodeId;
        bbAppendLog(`${unit.name} が移動した。`);
        const diedOnTheWay = bbApplyTerrainEffectsAlongPath(unit, movePath);
        bbRenderBoard();
        if (diedOnTheWay) {
            // 毒で力尽きた場合はそのまま次の手番へ（行動選択は行わない）。
            setTimeout(bbScheduleNextTurn, 500);
            return;
        }
        bbEnterActionPhase(unit);
    });
}

// 移動可能なマスの中から、targetNodeに一番近づけるマスを選ぶ（複数候補が同着ならランダム）。
// ※敵がいるマスはbbGetMovableNodeIdsの時点で候補に含まれないため、ここで敵マスを優先する
//   処理は不要（移動先として渡ってくる時点で必ず空きマス）。
function bbPickMoveTowardNode(unit, moves, targetNode) {
    let bestDist = Infinity;
    let bestMoves = [];
    moves.forEach(nid => {
        const d = bbDist(bbNodesById[nid], targetNode);
        if (d < bestDist - 0.01) { bestDist = d; bestMoves = [nid]; }
        else if (Math.abs(d - bestDist) <= 0.01) { bestMoves.push(nid); }
    });
    return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
}
// 生存中の自軍ユニットのうち、fromNodeに一番近い1体を返す（武闘派さんの追跡対象探し用）。
function bbGetNearestEnemyUnit(unit, fromNode) {
    const alive = bbState.units.filter(u => u.team !== unit.team && u.hp > 0);
    if (alive.length === 0) return null;
    let best = null, bestDist = Infinity;
    alive.forEach(u => {
        const d = bbDist(fromNode, bbNodesById[u.nodeId]);
        if (d < bestDist) { bestDist = d; best = u; }
    });
    return best;
}
// 旗に向かって最短距離で進む（直進ちゃん・ランダムくんの「旗」側の挙動）。
// ※毒マスをどうしても踏まずに済む経路がある場合の優先はbbGetMovableNodeIds側（パス単位の
//   タイブレーク）で既に行われているため、ここで改めて目的地を絞り込む必要はない。
function bbPerformEnemyTurnStraight(unit, moves) {
    const flagNodeId = bbGetFlagNodeId('player');
    if (moves.includes(flagNodeId)) return flagNodeId; // 旗のマスへ直接進めるなら最優先（そのターンで勝利）
    return bbPickMoveTowardNode(unit, moves, bbNodesById[flagNodeId]);
}
// 一番近い敵を追いかける（武闘派さん・ランダムくんの「戦闘」側の挙動）。
// 攻撃そのものは移動後の行動選択フェーズ（bbEnterActionPhase）で自動的に行われるため、
// ここでは「隣接できる位置まで近づく」ことだけを考える。
function bbPerformEnemyTurnCombat(unit, moves) {
    const target = bbGetNearestEnemyUnit(unit, bbNodesById[unit.nodeId]);
    const targetNodeId = target ? target.nodeId : bbGetFlagNodeId('player');
    return bbPickMoveTowardNode(unit, moves, bbNodesById[targetNodeId]);
}
function bbPerformEnemyTurn(unit) {
    const moves = bbGetMovableNeighbors(unit);
    if (moves.length === 0) {
        // 移動できる場所が無くても、隣接する敵や岩があれば行動できるかもしれないので、
        // 移動せず行動選択フェーズへ進む（何も対象が無ければそこでパスになる）。
        bbAppendLog(`${unit.name}（敵）は移動できないため、その場から行動を選ぶ。`);
        bbEnterActionPhase(unit);
        return;
    }
    // 対戦相手選択で選んだタイプに応じて行動パターンを切り替える：
    // ・直進ちゃん(straight)：常に旗へ最短距離で進む。
    // ・武闘派さん(combat)：一番近い敵を追う（隣接できれば行動選択フェーズで自動的に攻撃する）。
    // ・ランダムくん(random)：行動のたびに上記2つのどちらかをランダムに選ぶ。
    let mode = bbSelectedOpponentType;
    if (mode === 'random') mode = (Math.random() < 0.5) ? 'straight' : 'combat';
    const chosen = (mode === 'combat') ? bbPerformEnemyTurnCombat(unit, moves) : bbPerformEnemyTurnStraight(unit, moves);
    if (chosen == null) { bbEnterActionPhase(unit); return; }
    bbMoveUnitTo(unit, chosen);
}
function bbDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ------------------------------------------------------------
// 8.5 移動後の行動選択フェーズ
//    移動した（または移動せずその場に留まった）後、隣接マスに敵駒がいれば「攻撃」、
//    自分がわんぱくカレーで隣接マスに岩があれば「岩を攻撃」して破壊できる。
//    複数の対象がいても選べる行動は1回のみ（攻撃 or 岩破壊のどちらか1つだけ）。
// ------------------------------------------------------------
// 隣接マス（上下左右）にいる攻撃対象をまとめて返す。
// enemies: 隣接する敵駒（攻撃対象）の配列。rocks: 隣接する岩マスのノード（わんぱくのみ攻撃可）の配列。
function bbGetAdjacentActionTargets(unit) {
    const targets = { enemies: [], rocks: [] };
    const node = bbNodesById[unit.nodeId];
    if (!node) return targets;
    const canBreakRock = bbCanBreakRock(unit);
    node.neighbors.forEach(nid => {
        const n = bbNodesById[nid];
        const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
        if (occupant && occupant.team !== unit.team) {
            targets.enemies.push(occupant);
        } else if (!occupant && n.terrain === BB_TERRAIN_ROCK && canBreakRock) {
            targets.rocks.push(n);
        }
    });
    return targets;
}

function bbEnterActionPhase(unit) {
    if (bbState.phase !== 'battle' || !bbState.units.includes(unit) || unit.hp <= 0) { bbScheduleNextTurn(); return; }
    const targets = bbGetAdjacentActionTargets(unit);
    const hasTargets = targets.enemies.length > 0 || targets.rocks.length > 0;
    if (unit.team === 'player') {
        if (!hasTargets) {
            bbNodes.forEach(n => { n.highlight = null; });
            bbRenderBoard();
            setTimeout(bbScheduleNextTurn, 200);
            return;
        }
        bbState.subPhase = 'action';
        bbNodes.forEach(n => { n.highlight = null; });
        targets.enemies.forEach(u => { bbNodesById[u.nodeId].highlight = 'attackable'; });
        targets.rocks.forEach(n => { n.highlight = 'attackable'; });
        bbRenderBoard();
        bbSetBattleStatus(`${unit.name} の番です。攻撃する相手や岩をタップ（行動しないなら自分のマスをタップ）。`);
        return;
    }
    // 敵（AI）：攻撃できる相手がいれば最優先、いなければわんぱくなら隣接する岩を破壊する。
    let chosen = null;
    if (targets.enemies.length > 0) {
        chosen = targets.enemies[Math.floor(Math.random() * targets.enemies.length)];
    } else if (targets.rocks.length > 0) {
        chosen = targets.rocks[Math.floor(Math.random() * targets.rocks.length)];
    }
    if (!chosen) { setTimeout(bbScheduleNextTurn, 300); return; }
    setTimeout(() => { bbExecuteAction(unit, chosen); }, 300);
}

// プレイヤーが移動フェーズで自分のマスをタップ＝移動しない、を選んだ場合。
function bbSkipMoveToActionPhase(unit) {
    bbNodes.forEach(n => { n.highlight = null; });
    bbEnterActionPhase(unit);
}
// プレイヤーが行動選択フェーズで自分のマスをタップ＝何も行動しない、を選んだ場合。
function bbSkipActionEndTurn(unit) {
    bbNodes.forEach(n => { n.highlight = null; });
    bbAppendLog(`${unit.name} は行動しなかった。`);
    bbRenderBoard();
    setTimeout(bbScheduleNextTurn, 300);
}
// プレイヤーが行動選択フェーズで、ハイライトされた対象（敵駒 or 岩マス）をタップした場合。
function bbOnPickActionTarget(actor, nodeId) {
    const node = bbNodesById[nodeId];
    const defender = bbState.units.find(u => u.nodeId === nodeId && u.hp > 0 && u.team !== actor.team);
    if (defender) {
        bbShowUnitDetail(defender, { onConfirm: () => { bbExecuteAction(actor, defender); }, confirmLabel: 'この相手に攻撃する' });
        return;
    }
    if (node && node.terrain === BB_TERRAIN_ROCK) {
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('岩を攻撃', '隣接する岩マスを攻撃して破壊しますか？', () => { bbExecuteAction(actor, node); });
        } else {
            bbExecuteAction(actor, node);
        }
    }
}
// 選ばれた1つの行動を実行する。targetが盤面ノード（岩）ならそれを破壊、ユニットなら戦闘を行う。
function bbExecuteAction(unit, target) {
    bbNodes.forEach(n => { n.highlight = null; });
    if (target && target.terrain === BB_TERRAIN_ROCK) {
        target.terrain = null;
        bbAppendLog(`${unit.name} が岩を攻撃して破壊した！`);
        bbRenderBoard();
        setTimeout(bbScheduleNextTurn, 500);
        return;
    }
    bbResolveBattle(unit, target);
}

// ------------------------------------------------------------
// 9. 戦闘解決 ＋ 戦闘画面
//    本編に追加したwindow.startExternalBoardBattle(...)を直接呼び出す。これにより
//    「PCと対戦」と全く同じ戦闘エンジン（launchVsCutIn→startBattleScene→step→done）が
//    そのまま動作し、特殊カレー技・演出・音まで含めて本物の戦闘画面が表示される。
//    このファイルは本編game.htmlと同じ実行環境（同じ<script>群のグローバルスコープ）で
//    動いているため、iframeや別ウィンドウを介する必要が一切なく、
//    startExternalBoardBattle/getCurryImage/curryStockなどを直接呼び出せる。
//    カレーストックの経済・報酬・実績・クエスト進行には本編側（done()の
//    isBoardBattle分岐）で一切触れないようにしてあるため、ボードカレーバトルの
//    駒は勝敗にかかわらず消費されない。
//    ※隣接マスからの攻撃に変わったため（移動して重なる仕様は廃止）、勝った側の駒の
//    位置を移動させる処理はもう行わない（お互い元のマスに立ったまま戦闘する）。
// ------------------------------------------------------------
function bbResolveBattle(mover, defender) {
    const playerUnit = mover.team === 'player' ? mover : defender;
    const enemyUnit = mover.team === 'player' ? defender : mover;

    bbSetBattleStatus('戦闘画面を起動中…');
    const myCurrySnapshot = Object.assign({}, playerUnit.raw, { hp: playerUnit.hp });
    const oppCurrySnapshot = Object.assign({}, enemyUnit.raw, { hp: enemyUnit.hp, name: enemyUnit.name });

    if (typeof startExternalBoardBattle !== 'function') {
        console.error('[ボードバトル] startExternalBoardBattleが見つかりません（本編game.jsの反映が必要です）');
        bbSetBattleStatus('戦闘エンジンが見つかりません。game.jsの更新が必要です。');
        return;
    }

    // 本編の戦闘画面（vsCutIn/battleArena）はapplyBookBattleLift()により盤面（#bbRoot）より
    // 前面（z-index）へ持ち上がるので、#bbRoot自体は非表示にしない。代わりに#battleArenaへ
    // 半透明の専用背景クラスを付け、盤面が透けて見えるオーバーレイ表示にする
    // （通常のCSS z-index重なりだけで解決するため、表示/非表示の切り替えは不要）。
    const arenaEl = document.getElementById('battleArena');
    if (arenaEl) arenaEl.classList.add('bb-arena-overlay');
    // 戦闘カード（最大幅500px）の外側も含め、盤面に一切触れられないよう画面全体を覆う。
    const blockOverlayEl = document.getElementById('bbBattleBlockOverlay');
    if (blockOverlayEl) blockOverlayEl.style.display = 'block';

    startExternalBoardBattle(myCurrySnapshot, oppCurrySnapshot, function (didPlayerWin, remainingPlayerHp, remainingOppHp) {
        if (arenaEl) arenaEl.classList.remove('bb-arena-overlay');
        if (blockOverlayEl) blockOverlayEl.style.display = 'none';
        playerUnit.hp = remainingPlayerHp;
        enemyUnit.hp = remainingOppHp;
        const moverIsPlayer = (mover.team === 'player');
        const moverWon = moverIsPlayer ? didPlayerWin : !didPlayerWin;
        const winner = moverWon ? mover : defender;
        const loser = moverWon ? defender : mover;
        bbAppendLog(`${loser.name} は力尽きた。${winner.name} の勝ち（残HP ${winner.hp}/${winner.maxHp}）`);
        bbState.units = bbState.units.filter(u => u !== loser);
        bbRenderBoard();
        setTimeout(bbScheduleNextTurn, 500);
    });
}

function bbCheckWinCondition() {
    const playerUnits = bbState.units.filter(u => u.team === 'player' && u.hp > 0);
    const enemyUnits = bbState.units.filter(u => u.team === 'enemy' && u.hp > 0);
    if (enemyUnits.length === 0) return 'player';
    if (playerUnits.length === 0) return 'enemy';
    const playerOnEnemyFlag = playerUnits.some(u => u.nodeId === bbGetFlagNodeId('enemy'));
    if (playerOnEnemyFlag) return 'player';
    const enemyOnPlayerFlag = enemyUnits.some(u => u.nodeId === bbGetFlagNodeId('player'));
    if (enemyOnPlayerFlag) return 'enemy';
    return null;
}

function bbEndBattle(winner) {
    bbState.phase = 'result';
    bbState.activeUnit = null;
    document.getElementById('bbResultOverlay').style.display = 'flex';
    document.getElementById('bbResultTitle').textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('bbResultDesc').textContent = winner === 'player' ? '敵の旗を奪う、または全滅させました！' : '自陣の旗を奪われる、または全滅しました…';
}

// ------------------------------------------------------------
// 10. ログ・ステータス表示
// ------------------------------------------------------------
function bbAppendLog(text) {
    bbState.battleLogLines.push(text);
    const el = document.getElementById('bbBattleLog');
    el.textContent = bbState.battleLogLines.slice(-30).join('\n');
    el.scrollTop = el.scrollHeight;
}
function bbSetBattleStatus(text) {
    const el = document.getElementById('bbBattleStatusLine');
    if (el) el.textContent = text;
}

// ------------------------------------------------------------
// 11. 開閉・入り口ボタン
// ------------------------------------------------------------
function bbOpen() {
    document.getElementById('bbRoot').style.display = 'flex';
    bbInit();
}
function bbClose() {
    document.getElementById('bbRoot').style.display = 'none';
}
function bbRestart() {
    document.getElementById('bbResultOverlay').style.display = 'none';
    bbInit();
}

// ------------------------------------------------------------
// 11.5 盤面の駒をタップした時の詳細表示
// ------------------------------------------------------------
// opts.onConfirm を渡すと、詳細カードに「攻撃する」等の実行ボタンが追加表示される
// （敵の駒に重ねて移動＝攻撃する前に、相手の中身を見てから決められるようにするため）。
let bbPendingDetailConfirm = null;
function bbShowUnitDetail(unit, opts) {
    const overlay = document.getElementById('bbUnitDetailOverlay');
    const img = document.getElementById('bbUnitDetailImg');
    const nameEl = document.getElementById('bbUnitDetailName');
    const teamEl = document.getElementById('bbUnitDetailTeam');
    const statsEl = document.getElementById('bbUnitDetailStats');
    const confirmBtn = document.getElementById('bbUnitDetailConfirmBtn');
    if (!overlay || !img || !nameEl || !statsEl) return;
    const c = unit.raw || unit;
    img.src = bbGetCurryImg(c);
    nameEl.textContent = c.name || 'カレー';
    if (teamEl) {
        teamEl.textContent = (unit.team === 'player') ? '味方' : '敵';
        teamEl.className = 'bb-unitDetailTeam' + (unit.team === 'player' ? ' bb-team-player' : ' bb-team-enemy');
    }
    const total = bbStatTotal(c);
    statsEl.innerHTML = `
        <div class="bb-udStatRow"><span>HP</span><span>${unit.hp != null ? unit.hp : (c.hp || 0)} / ${unit.maxHp != null ? unit.maxHp : (c.hp || 0)}</span></div>
        <div class="bb-udStatRow"><span>ATK</span><span>${c.atk || 0}</span></div>
        <div class="bb-udStatRow"><span>DEF</span><span>${c.def || 0}</span></div>
        <div class="bb-udStatRow"><span>SPD</span><span>${c.spd || 0}</span></div>
        <div class="bb-udStatRow bb-udStatTotal"><span>合計</span><span>${total}</span></div>
    `;
    if (opts && typeof opts.onConfirm === 'function') {
        bbPendingDetailConfirm = opts.onConfirm;
        if (confirmBtn) {
            confirmBtn.style.display = 'inline-block';
            confirmBtn.textContent = opts.confirmLabel || '実行する';
        }
    } else {
        bbPendingDetailConfirm = null;
        if (confirmBtn) confirmBtn.style.display = 'none';
    }
    overlay.style.display = 'flex';
}
function bbConfirmUnitDetailAction() {
    const fn = bbPendingDetailConfirm;
    bbPendingDetailConfirm = null;
    bbCloseUnitDetail();
    if (typeof fn === 'function') fn();
}
function bbCloseUnitDetail() {
    bbPendingDetailConfirm = null;
    const overlay = document.getElementById('bbUnitDetailOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ------------------------------------------------------------
// 11.6 カレー準備画面（登録済みロースターの一覧・登録・編集）
// ------------------------------------------------------------
function bbRenderPrepPanel() {
    const list = document.getElementById('bbPrepRosterList');
    if (!list) return;
    list.innerHTML = bbRegisteredRoster.map((entry, idx) => {
        const eff = bbGetEffectiveCurry(entry);
        return `<div class="bb-rosterCard" onclick="window.__bbOnTapRegisteredCurry(${idx})">
            <div class="bb-rcVisual"><img src="${bbGetCurryImg(eff)}" alt=""></div>
            <div class="bb-rcName">${bbEsc(eff.name)}</div>
            <div class="bb-rcStats">HP${eff.hp||0} ATK${eff.atk||0}<br>DEF${eff.def||0} SPD${eff.spd||0}</div>
            <div class="bb-rcTotal">合計 ${bbStatTotal(eff)}</div>
        </div>`;
    }).join('') || '<div style="font-size:11px;color:#b88742;">登録済みのカレーがありません。「カレー登録」からカレーストックのカレーを登録してください。</div>';
    const countEl = document.getElementById('bbPrepCountLine');
    if (countEl) countEl.textContent = `登録数: ${bbRegisteredRoster.length} / ${BB_ROSTER_MAX}`;
    const startBtn = document.getElementById('bbBtnPrepStartBattle');
    if (startBtn) startBtn.disabled = (bbRegisteredRoster.length === 0);
}

// ---- 「カレー登録」：カレーストックから選んでロースターへ移す ----
function bbOnRegisterCurryClick() {
    if (bbRegisteredRoster.length >= BB_ROSTER_MAX) {
        alert(`カレー登録は最大${BB_ROSTER_MAX}個までです。`);
        return;
    }
    bbRenderRegisterPicker();
    const el = document.getElementById('bbRegisterPickerOverlay');
    if (el) el.style.display = 'flex';
}
function bbRenderRegisterPicker() {
    const list = document.getElementById('bbRegisterPickerList');
    if (!list) return;
    const candidates = bbLoadRealCurryStock(); // isDelivering・使い捨て一時カレーは除外済み
    list.innerHTML = candidates.map((c) => {
        const stockIdx = curryStock.indexOf(c);
        return `<div class="bb-rosterCard" onclick="window.__bbOnConfirmRegisterCurry(${stockIdx})">
            <div class="bb-rcVisual"><img src="${bbGetCurryImg(c)}" alt=""></div>
            <div class="bb-rcName">${bbEsc(c.name || 'カレー')}</div>
            <div class="bb-rcStats">HP${c.hp||0} ATK${c.atk||0}<br>DEF${c.def||0} SPD${c.spd||0}</div>
            <div class="bb-rcTotal">合計 ${bbStatTotal(c)}</div>
        </div>`;
    }).join('') || '<div style="font-size:11px;color:#b88742;">カレーストックに登録できるカレーがありません。</div>';
}
function bbCloseRegisterPicker() {
    const el = document.getElementById('bbRegisterPickerOverlay');
    if (el) el.style.display = 'none';
}
function bbOnConfirmRegisterCurry(stockIdx) {
    if (typeof curryStock === 'undefined' || stockIdx == null || stockIdx < 0 || stockIdx >= curryStock.length) return;
    if (bbRegisteredRoster.length >= BB_ROSTER_MAX) {
        alert(`カレー登録は最大${BB_ROSTER_MAX}個までです。`);
        return;
    }
    const curry = curryStock[stockIdx];
    const dispName = bbEsc(curry.name || 'カレー');
    const doRegister = function () {
        // 実際にストックから取り除いてからロースターへ移す（片道の移動）。
        const idxNow = curryStock.indexOf(curry);
        if (idxNow === -1) return; // 既に何らかの理由で無くなっていた場合は何もしない
        curryStock.splice(idxNow, 1);
        if (typeof selectedCurryIndex !== 'undefined') {
            if (selectedCurryIndex === idxNow) selectedCurryIndex = -1;
            else if (selectedCurryIndex > idxNow) selectedCurryIndex--;
        }
        bbRegisteredRoster.push({
            regId: 'bb' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            raw: curry,
            customName: null,
            equippedBase: '白米',
            equippedTableware: '白い皿'
        });
        bbSaveRegisteredRoster();
        // 本編のストック一覧（冷蔵庫タブ・調理タブ・対戦カレー選択等）をリロード無しで
        // 即座に更新する。本編で他の箇所がcurryStockを変更した時と同じ一式を呼んでおく。
        if (typeof saveGame === 'function') { try { saveGame(); } catch (e) {} }
        if (typeof updateFridgeUI === 'function') { try { updateFridgeUI(); } catch (e) {} }
        if (typeof updateCookSelects === 'function') { try { updateCookSelects(); } catch (e) {} }
        if (typeof updateMatchCurrySelects === 'function') { try { updateMatchCurrySelects(); } catch (e) {} }
        if (typeof updateShopButtons === 'function') { try { updateShopButtons(); } catch (e) {} }
        bbCloseRegisterPicker();
        bbRenderPrepPanel();
    };
    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm('🍛 カレー登録', `「${dispName}」をボードバトル用に登録しますか？<br><span style="color:#e74c3c;">登録するとカレーストックから削除されます。</span>`, doRegister);
    } else {
        doRegister();
    }
}

// ---- 登録済みカレーの詳細（装備・名前の変更／登録削除） ----
let bbRegDetailIndex = null;
function bbOnTapRegisteredCurry(idx) { bbShowRegDetail(idx); }
// ベース・食器の一覧を、選ぶ前から効果が分かるカード一覧として描画する
// （本編のshowBaseSelectModal/showTablewareSelectModalと同じ「選ばなくても効果が見える」見せ方）。
function bbRenderEquipOptionList(containerId, list, infoMap, currentVal, onSelectFnName) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = list.map(name => {
        const isSel = name === currentVal;
        const info = (infoMap && infoMap[name]) || { desc: '' };
        return `<div class="bb-equipOption${isSel ? ' bb-equipOptionSel' : ''}" onclick="window.${onSelectFnName}('${name}')">
            <div class="bb-equipOptionName">${bbEsc(name)}${isSel ? '（選択中）' : ''}</div>
            <div class="bb-equipOptionDesc">${bbEsc(info.desc || '')}</div>
        </div>`;
    }).join('');
}
function bbShowRegDetail(idx) {
    const entry = bbRegisteredRoster[idx];
    if (!entry) return;
    bbRegDetailIndex = idx;
    const eff = bbGetEffectiveCurry(entry);
    const raw = entry.raw || {};
    const img = document.getElementById('bbRegDetailImg');
    const nameInput = document.getElementById('bbRegDetailNameInput');
    const statsEl = document.getElementById('bbRegDetailStats');
    if (!img || !nameInput || !statsEl) return;
    img.src = bbGetCurryImg(eff);
    nameInput.value = entry.customName || raw.name || 'カレー';
    // 元のステータスに、装備による補正値を色付きの+-で併記する（本編の食器・ベース表示と同じ見せ方）。
    statsEl.innerHTML = `
        <div class="bb-udStatRow"><span>HP</span><span>${bbStatDisplayWithEquip('hp', raw.hp, entry)}</span></div>
        <div class="bb-udStatRow"><span>ATK</span><span>${bbStatDisplayWithEquip('atk', raw.atk, entry)}</span></div>
        <div class="bb-udStatRow"><span>DEF</span><span>${bbStatDisplayWithEquip('def', raw.def, entry)}</span></div>
        <div class="bb-udStatRow"><span>SPD</span><span>${bbStatDisplayWithEquip('spd', raw.spd, entry)}</span></div>
        <div class="bb-udStatRow bb-udStatTotal"><span>合計</span><span>${bbStatTotal(eff)}</span></div>
    `;
    const bases = (typeof getUnlockedBase === 'function') ? getUnlockedBase() : ['白米'];
    const tablewares = (typeof getUnlockedTableware === 'function') ? getUnlockedTableware() : ['白い皿'];
    const baseInfoMap = (typeof BASE_LIST !== 'undefined') ? BASE_LIST : {};
    const twInfoMap = (typeof TABLEWARE_LIST !== 'undefined') ? TABLEWARE_LIST : {};
    bbRenderEquipOptionList('bbRegDetailBaseList', bases, baseInfoMap, entry.equippedBase, '__bbSelectRegBase');
    bbRenderEquipOptionList('bbRegDetailTablewareList', tablewares, twInfoMap, entry.equippedTableware, '__bbSelectRegTableware');
    bbRenderRegDetailNavCards(idx);
    const overlay = document.getElementById('bbRegDetailOverlay');
    if (overlay) overlay.style.display = 'flex';
}
function bbSelectRegBase(name) {
    if (bbRegDetailIndex === null) return;
    const entry = bbRegisteredRoster[bbRegDetailIndex];
    if (!entry) return;
    const owned = (typeof getUnlockedBase === 'function') ? getUnlockedBase() : ['白米'];
    if (!owned.includes(name)) return;
    entry.equippedBase = name;
    bbSaveRegisteredRoster();
    bbShowRegDetail(bbRegDetailIndex); // ステータス表示を装備反映後の値に更新
    bbRenderPrepPanel();
}
function bbSelectRegTableware(name) {
    if (bbRegDetailIndex === null) return;
    const entry = bbRegisteredRoster[bbRegDetailIndex];
    if (!entry) return;
    const owned = (typeof getUnlockedTableware === 'function') ? getUnlockedTableware() : ['白い皿'];
    if (!owned.includes(name)) return;
    entry.equippedTableware = name;
    bbSaveRegisteredRoster();
    bbShowRegDetail(bbRegDetailIndex);
    bbRenderPrepPanel();
}
// ---- 詳細カード左右の「次/前のカレー」プレビュー＋スワイプでの移動 ----
function bbRenderRegDetailNavCards(idx) {
    const prevEl = document.getElementById('bbRegDetailPrevCard');
    const nextEl = document.getElementById('bbRegDetailNextCard');
    const prevEntry = bbRegisteredRoster[idx - 1];
    const nextEntry = bbRegisteredRoster[idx + 1];
    if (prevEl) {
        if (prevEntry) {
            const prevEff = bbGetEffectiveCurry(prevEntry);
            prevEl.innerHTML = `<img src="${bbGetCurryImg(prevEff)}" alt=""><div class="bb-regNavCardName">${bbEsc(prevEff.name)}</div>`;
            prevEl.style.visibility = 'visible';
        } else {
            prevEl.innerHTML = '';
            prevEl.style.visibility = 'hidden';
        }
    }
    if (nextEl) {
        if (nextEntry) {
            const nextEff = bbGetEffectiveCurry(nextEntry);
            nextEl.innerHTML = `<img src="${bbGetCurryImg(nextEff)}" alt=""><div class="bb-regNavCardName">${bbEsc(nextEff.name)}</div>`;
            nextEl.style.visibility = 'visible';
        } else {
            nextEl.innerHTML = '';
            nextEl.style.visibility = 'hidden';
        }
    }
}
function bbRegDetailNav(delta) {
    if (bbRegDetailIndex === null) return;
    const newIdx = bbRegDetailIndex + delta;
    if (newIdx < 0 || newIdx >= bbRegisteredRoster.length) return;
    bbShowRegDetail(newIdx);
}
let bbRegDetailSwipeStartX = null;
function bbOnRegDetailPointerDown(evt) { bbRegDetailSwipeStartX = evt.clientX; }
function bbOnRegDetailPointerUp(evt) {
    if (bbRegDetailSwipeStartX === null) return;
    const dx = evt.clientX - bbRegDetailSwipeStartX;
    bbRegDetailSwipeStartX = null;
    if (Math.abs(dx) < 40) return; // 閾値未満はタップ扱い（ボタン操作等を妨げない）
    if (dx < 0) bbRegDetailNav(1); // 左スワイプ→次のカレーへ
    else bbRegDetailNav(-1); // 右スワイプ→前のカレーへ
}
function bbOnChangeRegName() {
    if (bbRegDetailIndex === null) return;
    const entry = bbRegisteredRoster[bbRegDetailIndex];
    if (!entry) return;
    const nameInput = document.getElementById('bbRegDetailNameInput');
    const v = nameInput ? nameInput.value.trim() : '';
    entry.customName = v ? v : null;
    bbSaveRegisteredRoster();
    bbRenderPrepPanel();
}
function bbCloseRegDetail() {
    bbRegDetailIndex = null;
    const overlay = document.getElementById('bbRegDetailOverlay');
    if (overlay) overlay.style.display = 'none';
}
function bbOnDeleteRegisteredCurry() {
    if (bbRegDetailIndex === null) return;
    const idx = bbRegDetailIndex;
    const entry = bbRegisteredRoster[idx];
    if (!entry) return;
    const dispName = bbEsc(entry.customName || entry.raw.name || 'カレー');
    const doDelete = function () {
        bbRegisteredRoster.splice(idx, 1);
        bbSaveRegisteredRoster();
        bbCloseRegDetail();
        bbRenderPrepPanel();
    };
    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm('🗑 登録削除', `「${dispName}」の登録を削除しますか？<br><span style="color:#e74c3c;">削除してもカレーストックには戻りません。</span>`, doDelete);
    } else {
        doDelete();
    }
}

// ---- 「カレーボードバトルとは？」ヘルプ ----
function bbShowHelp() {
    const el = document.getElementById('bbHelpOverlay');
    if (el) el.style.display = 'flex';
}
function bbCloseHelp() {
    const el = document.getElementById('bbHelpOverlay');
    if (el) el.style.display = 'none';
}

// ------------------------------------------------------------
// 12. DOM注入（起動時に一度だけ実行。#pageTop等の状態には依存しない）
// ------------------------------------------------------------
function bbInjectDom() {
    const styleEl = document.createElement('style');
    styleEl.id = 'bbStyle';
    styleEl.textContent = BB_STYLE;
    document.head.appendChild(styleEl);

    const rootDiv = document.createElement('div');
    rootDiv.id = 'bbRoot';
    rootDiv.innerHTML = `
        <div id="bbAppRoot">
            <div id="bbPrepPanel">
                <h2>カレー準備</h2>
                <div id="bbPrepCountLine">登録数: 0 / 20</div>
                <div id="bbPrepRosterList"></div>
                <div class="bb-prepBtnRow">
                    <button class="bb-actionBtn" onclick="window.__bbOnRegisterCurryClick()">カレー登録</button>
                    <button class="bb-actionBtn" id="bbBtnPrepStartBattle" disabled onclick="window.__bbOnPrepStartBattleClick()">準備完了</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbShowHelp()">カレーボードバトルとは？</button>
                </div>
            </div>
            <div id="bbBoardWrap">
                <svg id="bbBoardSvg" viewBox="0 0 600 900"><g id="bbViewportG"></g></svg>
            </div>
            <div id="bbTopOverlay">
                <div id="bbHeaderBar">
                    <h1>ボードカレーバトル</h1>
                    <div class="bb-header-right">
                        <span class="bb-devBadge">開発版</span>
                        <button class="bb-closeBtn" onclick="window.__bbClose()">✕ 閉じる</button>
                    </div>
                </div>
                <div id="bbTurnQueueBar"></div>
            </div>
            <div id="bbBottomPanel">
                <div id="bbPlacementPanel">
                    <h2>配置フェーズ（自陣（旗の行を含む下2列）・ステータス合計3000まで・最大5体）</h2>
                    <div id="bbBudgetLine">合計ステータス: 0 / 3000（残り3000）　配置数: 0 / 5</div>
                    <div id="bbPlaceHint">下のカレーをタップして選択 → 盤面の自陣側（青枠）マスをタップして配置します。</div>
                    <div id="bbRosterList"></div>
                    <button class="bb-actionBtn" id="bbBtnStartBattle" disabled onclick="window.__bbOnStartBattleClick()">戦闘開始</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnRegenerateEnemyClick()">敵編成を再生成（デバッグ）</button>
                </div>
                <div id="bbBattlePanel" style="display:none;">
                    <h2 id="bbBattleStatusLine">戦闘中…</h2>
                    <div id="bbBattleLog"></div>
                </div>
            </div>
        </div>
        <div id="bbResultOverlay">
            <div id="bbResultBox">
                <h2 id="bbResultTitle">VICTORY</h2>
                <div id="bbResultDesc" style="font-size:13px; margin-bottom:16px;"></div>
                <button class="bb-actionBtn" onclick="window.__bbRestart()">もう一度</button>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbClose()">閉じる</button>
            </div>
        </div>
        <div id="bbBattleBlockOverlay"></div>
        <div id="bbUnitDetailOverlay" onclick="if(event.target===this) window.__bbCloseUnitDetail()">
            <div id="bbUnitDetailBox">
                <div id="bbUnitDetailVisual"><img id="bbUnitDetailImg" src="" alt=""></div>
                <div id="bbUnitDetailTeam" class="bb-unitDetailTeam"></div>
                <h3 id="bbUnitDetailName"></h3>
                <div id="bbUnitDetailStats"></div>
                <button class="bb-actionBtn" id="bbUnitDetailConfirmBtn" style="display:none;" onclick="window.__bbConfirmUnitDetailAction()">実行する</button>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseUnitDetail()">閉じる</button>
            </div>
        </div>
        <div id="bbRegisterPickerOverlay" onclick="if(event.target===this) window.__bbCloseRegisterPicker()">
            <div id="bbRegisterPickerBox">
                <h3>カレーを登録</h3>
                <div id="bbRegisterPickerList"></div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseRegisterPicker()">閉じる</button>
            </div>
        </div>
        <div id="bbRegDetailOverlay" onclick="if(event.target===this) window.__bbCloseRegDetail()">
            <div id="bbRegDetailCarouselRow">
                <div id="bbRegDetailPrevCard" class="bb-regNavCard" onclick="window.__bbRegDetailNav(-1)"></div>
                <div id="bbRegDetailBox">
                    <div id="bbRegDetailVisual"><img id="bbRegDetailImg" src="" alt=""></div>
                    <input id="bbRegDetailNameInput" type="text" maxlength="20" placeholder="カレー名" onblur="window.__bbOnChangeRegName()">
                    <div id="bbRegDetailStats"></div>
                    <div class="bb-regEquipSectionLabel">ベース</div>
                    <div id="bbRegDetailBaseList" class="bb-regEquipOptionList"></div>
                    <div class="bb-regEquipSectionLabel">食器</div>
                    <div id="bbRegDetailTablewareList" class="bb-regEquipOptionList"></div>
                    <div class="bb-regDetailBtnRow">
                        <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseRegDetail()">閉じる</button>
                        <button class="bb-actionBtn bb-danger bb-small" onclick="window.__bbOnDeleteRegisteredCurry()">登録削除</button>
                    </div>
                </div>
                <div id="bbRegDetailNextCard" class="bb-regNavCard" onclick="window.__bbRegDetailNav(1)"></div>
            </div>
        </div>
        <div id="bbHelpOverlay" onclick="if(event.target===this) window.__bbCloseHelp()">
            <div id="bbHelpBox">
                <h3>カレーボードバトルとは？</h3>
                <div id="bbHelpText">
                    9×9の盤面の上下にある「旗」（王将の位置）を奪うか、相手を全滅させれば勝利です。<br><br>
                    ・「カレー登録」で、カレーストックからボードバトル専用にカレーを登録できます（登録すると通常のストックからは無くなります。最大20個まで）。<br>
                    ・登録したカレーは名前の変更や、ベース・食器の個別装備ができます（本編の装備とは別枠です）。<br>
                    ・「準備完了」を押すと対戦相手を選び、配置フェーズになります。登録済みのカレーの中から、ステータス合計3000・最大5体まで盤面の自陣側に配置してください。<br>
                    ・配置が終わったら「戦闘開始」で戦闘スタート。SPDの高い駒から順に、生存者全員が1周につき必ず1回行動します（行動順は敵味方共通の1本のタイムライン）。<br>
                    ・移動は上下左右のみ（斜め移動は不可）。SPDが高いほど1回に動けるマス数が増え、他の駒がいるマスは通り抜けられません。<br>
                    ・盤面には「岩」「水」「毒」の特殊マスがあります。岩はわんぱくカレーのみ壊して通過でき、以後は誰でも通れる普通のマスになります。水は海の幸カレーのみ通過・停止でき、他のカレーは通れません。毒は誰でも通過・停止できますが、毒系カレー以外は最大HPの20%のダメージを受けます。<br>
                    ・移動して相手の駒と重なると、そのまま本編の戦闘画面で1対1のバトルが始まります。
                </div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseHelp()">閉じる</button>
            </div>
        </div>
        <div id="bbOpponentSelectOverlay" onclick="if(event.target===this) window.__bbCloseOpponentSelect()">
            <div id="bbOpponentSelectBox">
                <h3>対戦相手を選ぶ</h3>
                <div class="bb-equipOption" onclick="window.__bbSelectOpponentType('random')">
                    <div class="bb-equipOptionName">ランダムくん</div>
                </div>
                <div class="bb-equipOption" onclick="window.__bbSelectOpponentType('straight')">
                    <div class="bb-equipOptionName">直進ちゃん</div>
                </div>
                <div class="bb-equipOption" onclick="window.__bbSelectOpponentType('combat')">
                    <div class="bb-equipOptionName">武闘派さん</div>
                </div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseOpponentSelect()">戻る</button>
            </div>
        </div>
    `;
    document.body.appendChild(rootDiv);

    // 盤面のパン・ズーム操作の配線（マウスのドラッグ・ホイールと、指1本でのパン・
    // 指2本でのピンチズームをPointer Eventsで統一的に扱う）。
    const bbWrapEl = document.getElementById('bbBoardWrap');
    bbWrapEl.addEventListener('pointerdown', bbOnPointerDown);
    bbWrapEl.addEventListener('pointermove', bbOnPointerMove);
    bbWrapEl.addEventListener('pointerup', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('pointercancel', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('pointerleave', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('wheel', bbOnWheel, { passive: false });
    bbWrapEl.addEventListener('click', bbOnBoardClickCapture, true);

    // 登録済みカレー詳細カード：左右スワイプで前後のカレーへ移動できるようにする
    // （左右のプレビューカードのタップと合わせて、2通りの操作を用意する）。
    const bbRegDetailBoxEl = document.getElementById('bbRegDetailBox');
    if (bbRegDetailBoxEl) {
        bbRegDetailBoxEl.addEventListener('pointerdown', bbOnRegDetailPointerDown);
        bbRegDetailBoxEl.addEventListener('pointerup', bbOnRegDetailPointerUp);
    }

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('resize', function () {
            if (document.getElementById('bbRoot').style.display !== 'none' && bbState.phase !== 'prep') bbFitView();
        });
    }

    const launcherBtn = document.createElement('button');
    launcherBtn.id = 'bbLauncherBtn';
    launcherBtn.textContent = '🎲 ボードバトル（開発中）';
    launcherBtn.onclick = bbOpen;
    document.body.appendChild(launcherBtn);

    // 本人のデバッグモードが有効な間だけ入り口ボタンを表示する（フェスデバッグパネルと同じ判定方法）。
    // isDebugModeはgame.js側の読み込み・Firebase同期タイミングに依存するため、ポーリングで反映する。
    setInterval(function () {
        const shouldShow = (typeof isDebugMode !== 'undefined' && !!isDebugMode);
        launcherBtn.style.display = shouldShow ? 'flex' : 'none';
    }, 1000);
}

// インラインonclick属性から呼べるよう、必要な関数だけを明示的にwindowへ公開する
// （このファイル全体はIIFEで閉じているため、windowへ代入しない限りグローバルには出ない）。
window.__bbOnNodeClick = bbOnNodeClick;
window.__bbOnPickPoolCurry = bbOnPickPoolCurry;
window.__bbOnStartBattleClick = bbOnStartBattleClick;
window.__bbOnRegenerateEnemyClick = bbOnRegenerateEnemyClick;
window.__bbClose = bbClose;
window.__bbRestart = bbRestart;
window.__bbCloseUnitDetail = bbCloseUnitDetail;
window.__bbConfirmUnitDetailAction = bbConfirmUnitDetailAction;
window.__bbOnPrepStartBattleClick = bbOnPrepStartBattleClick;
window.__bbOnRegisterCurryClick = bbOnRegisterCurryClick;
window.__bbCloseRegisterPicker = bbCloseRegisterPicker;
window.__bbOnConfirmRegisterCurry = bbOnConfirmRegisterCurry;
window.__bbOnTapRegisteredCurry = bbOnTapRegisteredCurry;
window.__bbSelectRegBase = bbSelectRegBase;
window.__bbSelectRegTableware = bbSelectRegTableware;
window.__bbRegDetailNav = bbRegDetailNav;
window.__bbOnChangeRegName = bbOnChangeRegName;
window.__bbCloseRegDetail = bbCloseRegDetail;
window.__bbOnDeleteRegisteredCurry = bbOnDeleteRegisteredCurry;
window.__bbShowHelp = bbShowHelp;
window.__bbCloseHelp = bbCloseHelp;
window.__bbCloseOpponentSelect = bbCloseOpponentSelect;
window.__bbSelectOpponentType = bbSelectOpponentType;
window.openBoardBattle = bbOpen; // 将来、他の場所（正式な入り口ボタン等）から開けるように

bbInjectDom();

})();
