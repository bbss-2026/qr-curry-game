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
/* 本編と同じミュート状態（toggleMute/isMuted）をそのまま流用する専用ボタン。
   本編ヘッダーの#muteBtnは#bbRoot（z-index:9000）の下に隠れてしまうため、本のボス戦専用の
   #bookBattleMuteBtnと同じ考え方で、ボードバトル側にも同期表示するミュートボタンを常設する。
   sound-on.svg/sound-off.svgのアイコンはfill:#420000で、これがヘッダー背景
   （rgba(66,0,0,0.92)＝ほぼ同じ色）に紛れて実質見えなくなっていたため、明るい円形の
   背景を敷いてアイコンが常にはっきり見えるようにする。 */
.bb-muteBtn {
    background: #efdeb1; border: none; border-radius: 50%; padding: 0; width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.bb-muteBtn img { width: 18px; height: 18px; display: block; }

/* 配置・戦闘フェーズ中、選択中の対戦相手ボットのイラストと名前を表示する。#bbTopOverlay
   （固定のヘッダー帯）ではなく、盤面と同じ#bbBoardWrapの中に置き、盤のパン・ズームに
   連動して動く「盤の一部」として、敵陣の赤旗の少し上あたりに浮かべる（bbPositionOpponentBanner
   が毎フレームbbView.x/y/scaleに合わせて位置・拡大率を更新する）。画像を大きく、その下に
   名前を表示する縦並びレイアウトにしている。 */
#bbOpponentBanner {
    display: none; position: absolute; left: 0; top: 0; flex-direction: column; align-items: center; gap: 4px;
    pointer-events: none; z-index: 3; transform-origin: 50% 100%;
}
#bbOpponentBanner img {
    width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid #e5564a;
    box-shadow: 0 3px 8px rgba(0,0,0,0.5); background: #fff; flex-shrink: 0;
}
#bbOpponentBanner .bb-opponentBannerName {
    font-size: 12px; color: #efdeb1; font-weight: bold; white-space: nowrap;
    background: rgba(66,0,0,0.85); border: 1px solid rgba(229,86,74,0.8); border-radius: 10px; padding: 2px 10px;
}

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
/* 駒の詳細カードを開いている間、行動順の帯の中でその駒に対応するアイコンを光らせて、
   行動順の中での位置がひと目で分かるようにする（bbHighlightTurnIcon参照）。 */
.bb-turnIcon.bb-turnIcon-highlighted { border-color: #ffe066; box-shadow: 0 0 14px 4px rgba(255,224,102,0.85); opacity: 1; }
.bb-turnIcon { cursor: pointer; }

/* 配置フェーズ中だけ、本来の行動順の帯（#bbTurnQueueBar、戦闘フェーズ専用）の代わりに
   同じ位置へ「敵の出撃予定」のカレー駒アイコンを表示する。 */
#bbEnemyPreviewBar {
    display: none; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(58,36,19,0.88);
    border-bottom: 1px solid rgba(107,74,38,0.8); overflow-x: auto; min-height: 62px; flex-shrink: 0;
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
}
#bbEnemyPreviewBar .bb-enemyPreviewLabel { font-size: 10px; color: #b88742; flex-shrink: 0; margin-right: 2px; white-space: nowrap; }

/* 盤面は#bbAppRoot全体に敷き詰め、ヘッダー等の下にも回り込ませる（地図アプリのタイル層と同じ考え方）。
   ネイティブのスクロール（overflow:auto）は使わず、pointer/wheelイベントで自前のパン・ズームを実装する。 */
/* 盤面を斜め上から見下ろしたような立体感を出すため、SVG本体だけにCSSの3D変形を掛ける。
   パン・ズームのポインタ計算（bbGetWrapPoint等）は#bbBoardWrap自身のgetBoundingClientRect()
   を基準にしており、#bbBoardWrapそのものは変形させていないため、ドラッグ・ピンチ・タップの
   当たり判定には影響しない（ブラウザは3D変形後の見た目の位置からでもクリック対象を
   正しく解決してくれるため、タイルのタップ自体も問題なく機能する）。 */
#bbBoardWrap { position: absolute; inset: 0; overflow: hidden; touch-action: none; background: #2b1a0e; perspective: 1200px; }
#bbBoardSvg {
    width: 100%; height: 100%; display: block;
    transform: rotateX(40deg);
    transform-origin: 50% 50%;
}
.bb-board-edge { stroke: #6b4a26; stroke-width: 2; }
/* マスの背景は<image>（boardbattle/map0X.png）で描画するため、タイル自体のfillは持たず、
   枠線（通常時/選択可能時/移動可能時/攻撃可能時などのハイライト）だけをこのrectで担う。 */
/* fill:noneのSVG要素は既定（pointer-events:visiblePainted）だとstroke（枠線）部分しか
   クリック／タップを拾わなくなる（マス中央の透明な塗りつぶし部分が反応しない不具合の原因）。
   pointer-events:allでfillの有無に関係なくマス全体を判定対象にする。 */
.bb-board-node-tile { fill: none; stroke: #6b4a26; stroke-width: 3; cursor: default; pointer-events: all; }
.bb-board-tile-img { pointer-events: none; }
.bb-board-node-tile.bb-flag-tile { stroke: #b88742; stroke-width: 4; }
.bb-board-node-tile.bb-selectable { stroke: #2ecc71; stroke-width: 4; cursor: pointer; }
.bb-board-node-tile.bb-movable { stroke: #f1c40f; stroke-width: 4; cursor: pointer; }
.bb-board-node-tile.bb-attackable { stroke: #ff4136; stroke-width: 5; cursor: pointer; }
.bb-board-node-tile.bb-trapSelectable { stroke: #f1c40f; stroke-width: 3; stroke-dasharray: 6 4; cursor: pointer; }
.bb-board-node-tile.bb-occupied-player { stroke: #3498db; }
.bb-board-node-tile.bb-occupied-enemy { stroke: #e74c3c; }
/* 駒をタップして詳細カードを開いている間、その駒の移動可能範囲を確認できるよう、
   通常の移動先ハイライト（黄色・bb-movable）とは別枠で、その駒のチームカラーの
   枠だけを重ねて表示する（自分の手番中の本来の移動可能ハイライトとは独立して管理する）。 */
.bb-board-node-tile.bb-move-preview-player { stroke: #3498db; stroke-width: 4; stroke-dasharray: 6 4; }
.bb-board-node-tile.bb-move-preview-enemy { stroke: #e74c3c; stroke-width: 4; stroke-dasharray: 6 4; }
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
/* コマ＝厚みのあるコイン型トークン。上面にカレーイラスト、側面（下にずらして重ねた円）を
   自陣＝青／敵陣＝赤で塗り分けて、コインの厚み・チーム色が一目でわかるようにする。 */
.bb-coin-side { pointer-events: none; }
.bb-coin-top-bg { fill: #efdeb1; pointer-events: none; }
.bb-coin-top-ring { fill: none; stroke-width: 2.5; pointer-events: none; }
/* 移動後の行動選択フェーズ：攻撃対象（隣接する敵駒・岩）へ向かって進んでいくような
   矢印（三角形）アニメーション。上下左右いずれの向きでも同じ見た目になるよう、
   4方向ぶんのキーフレームをそれぞれ用意する。 */
.bb-attack-arrow {
    fill: #ff4136; stroke: #7a0d06; stroke-width: 1; pointer-events: none;
    transform-box: fill-box; transform-origin: center;
    filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
}
.bb-attack-arrow.bb-arrow-up { animation: bbArrowMarchUp 0.85s ease-in-out infinite; }
.bb-attack-arrow.bb-arrow-down { animation: bbArrowMarchDown 0.85s ease-in-out infinite; }
.bb-attack-arrow.bb-arrow-left { animation: bbArrowMarchLeft 0.85s ease-in-out infinite; }
.bb-attack-arrow.bb-arrow-right { animation: bbArrowMarchRight 0.85s ease-in-out infinite; }
@keyframes bbArrowMarchUp    { 0% { transform: translateY(8px);  opacity: 0.2; } 55% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
@keyframes bbArrowMarchDown  { 0% { transform: translateY(-8px); opacity: 0.2; } 55% { opacity: 1; } 100% { transform: translateY(10px);  opacity: 0; } }
@keyframes bbArrowMarchLeft  { 0% { transform: translateX(8px);  opacity: 0.2; } 55% { opacity: 1; } 100% { transform: translateX(-10px); opacity: 0; } }
@keyframes bbArrowMarchRight { 0% { transform: translateX(-8px); opacity: 0.2; } 55% { opacity: 1; } 100% { transform: translateX(10px);  opacity: 0; } }
/* ダメージPOP（毒マス通過時など）：マス位置から数字が浮かび上がって消える。
   盤面のSVG自体はCSSの3D変形（rotateX）で傾けているため、その内部に描くと数字も
   一緒に傾いて見えてしまう。そこで盤面と同じ画面位置に追従させつつ、見た目自体は
   傾きの影響を受けない平面のHTMLレイヤー（#bbFxLayer、bbBoardSvgの外側の兄弟要素）に
   数字を表示する（＝常に正面を向いたまま表示される）。 */
#bbFxLayer { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
.bb-damage-pop-html {
    position: absolute; left: 0; top: 0; transform: translate(-50%, -18px);
    font-size: 18px; font-weight: 900; color: #ff4136; white-space: nowrap;
    /* -webkit-text-strokeは太くすると文字そのものを塗りつぶして潰れて見えるため使わず、
       文字色の下に黒を敷くように複数方向のtext-shadowを重ねて外側だけに縁取りを作る。 */
    text-shadow:
        -2px -2px 0 #3a0a06, 2px -2px 0 #3a0a06, -2px 2px 0 #3a0a06, 2px 2px 0 #3a0a06,
        -2px 0 0 #3a0a06, 2px 0 0 #3a0a06, 0 -2px 0 #3a0a06, 0 2px 0 #3a0a06;
    opacity: 1; transition: transform 0.7s ease-out, opacity 0.7s ease-out;
}
.bb-damage-pop-html.bb-damage-pop-html-anim { opacity: 0; transform: translate(-50%, -44px); }
/* 太陽の恵みの回復POP（緑）／ネバネバクダンで1回休みになった駒が、行動順到来時に
   ❌が上へ消えていく演出（bb-heal-popと同じ仕組みを流用し、色だけ変える）。*/
.bb-damage-pop-html.bb-heal-pop { color: #2ecc71; text-shadow: -2px 0 0 #0b3a1c, 2px 0 0 #0b3a1c, 0 -2px 0 #0b3a1c, 0 2px 0 #0b3a1c; }
.bb-damage-pop-html.bb-skip-pop { color: #ff4136; font-size: 22px; }
/* 1回休み中の駒（盤上のコマ・行動順バーのアイコン）に常時重ねて表示する❌マーク。 */
.bb-skip-badge { font-size: 20px; font-weight: 900; fill: #ff4136; text-anchor: middle; dominant-baseline: central; paint-order: stroke; stroke: #3a0a06; stroke-width: 3px; pointer-events: none; }
.bb-turnIcon { position: relative; }
.bb-turnIcon.bb-skip-pending::after {
    content: '❌'; position: absolute; right: -2px; top: -4px; font-size: 12px; line-height: 1;
}

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

/* ボードバトル開始時のタイトル演出：画面の上下左右中央に一時的に表示し、フェードイン・
   アウトする。盤面や他のUIをブロックしないようpointer-events:noneにしておく。 */
#bbBattleStartSplash {
    position: fixed; inset: 0; z-index: 9025; display: none; flex-direction: column;
    align-items: center; justify-content: center; pointer-events: none;
    opacity: 0; transition: opacity 0.3s ease;
    text-align: center;
}
#bbBattleStartSplash.bb-show { opacity: 1; }
/* -webkit-text-strokeは文字の輪郭の内外にまたがって太い線を引くため、太字と組み合わさると
   文字そのものを塗りつぶして潰れて見えてしまう。そこで文字の縁取りは輪郭線ではなく、
   本来の文字色の下（背面）に複数方向へずらした黒い文字を重ねて敷く方式（text-shadow）に
   することで、外側にだけ縁取りが付き、文字自体の形は潰れなくなる。 */
#bbBattleStartSplashLine1, #bbBattleStartSplashLine2 {
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    color: #ffcc33; font-weight: 900;
    letter-spacing: 0.04em;
}
#bbBattleStartSplashLine1 {
    font-size: 26px; margin-bottom: 6px;
    text-shadow:
        -3px -3px 0 #1a0d00, 3px -3px 0 #1a0d00, -3px 3px 0 #1a0d00, 3px 3px 0 #1a0d00,
        -3px 0 0 #1a0d00, 3px 0 0 #1a0d00, 0 -3px 0 #1a0d00, 0 3px 0 #1a0d00,
        0 4px 0 rgba(0,0,0,0.35), 0 0 14px rgba(0,0,0,0.75);
}
#bbBattleStartSplashLine2 {
    font-size: 52px; letter-spacing: 0.1em;
    text-shadow:
        -5px -5px 0 #1a0d00, 5px -5px 0 #1a0d00, -5px 5px 0 #1a0d00, 5px 5px 0 #1a0d00,
        -5px 0 0 #1a0d00, 5px 0 0 #1a0d00, 0 -5px 0 #1a0d00, 0 5px 0 #1a0d00,
        0 4px 0 rgba(0,0,0,0.35), 0 0 14px rgba(0,0,0,0.75);
}

/* 盤の上に表示するカード（コマンドメニュー・詳細画面）共通：盤が見えないと困るため
   背景を透過し、カード自体もドラッグでどかせるようにする。 */
.bb-cardCloseX {
    position: absolute; top: 6px; right: 8px; width: 26px; height: 26px; line-height: 24px;
    background: transparent; border: none; color: #fff; font-size: 20px; font-weight: bold;
    cursor: pointer; padding: 0; z-index: 2;
}
.bb-boardCard { position: relative; cursor: grab; touch-action: none; }
.bb-boardCard.bb-dragging { cursor: grabbing; }

/* 盤面の駒をタップした時に出す簡易ステータスカード（配置フェーズ・戦闘フェーズ共通） */
#bbUnitDetailOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; z-index: 9020; pointer-events: none;
}
#bbUnitDetailBox { background: rgba(43,26,14,0.82); border: 2px solid #b88742; border-radius: 12px; padding: 20px 26px; text-align: center; width: 220px; pointer-events: auto; }
#bbUnitDetailVisual { width: 84px; height: 84px; margin: 0 auto 8px; border-radius: 50%; overflow: hidden; background: #fff; border: 3px solid #b88742; }
#bbUnitDetailVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-unitDetailTeam { display: inline-block; font-size: 10px; padding: 2px 10px; border-radius: 10px; margin-bottom: 6px; background: #555; }
.bb-unitDetailTeam.bb-team-player { background: #2980b9; }
.bb-unitDetailTeam.bb-team-enemy { background: #c0392b; }
#bbUnitDetailName { font-size: 15px; margin: 0 0 10px 0; color: #efdeb1; }
#bbUnitDetailStats { font-size: 12px; text-align: left; }
.bb-udStatRow { display: flex; justify-content: space-between; padding: 3px 4px; border-bottom: 1px solid rgba(107,74,38,0.6); }
.bb-udStatRow.bb-udStatTotal { border-bottom: none; margin-top: 4px; font-weight: bold; color: #f1c40f; }
/* 駒の詳細カード・カレー準備画面の詳細に共通で使う、使用できる技の一覧表示。 */
.bb-skillList { font-size: 11px; text-align: left; margin: 6px 0 10px 0; }
.bb-skillRow { padding: 3px 4px; border-bottom: 1px solid rgba(107,74,38,0.4); }
.bb-skillRow:last-child { border-bottom: none; }
.bb-skillName { font-weight: bold; color: #f1c40f; }
.bb-skillDesc { color: #efdeb1; margin-left: 4px; }
.bb-skillNone { color: #8a7250; }

/* 駒タップ→コマンドメニュー（戦闘を挑む／特技／待機／詳細）。使用できない項目は
   .bb-actionBtn:disabledの既存スタイル（グレーアウト）がそのまま適用される。 */
#bbCommandMenuOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; z-index: 9018; pointer-events: none;
}
#bbCommandMenuBox { background: rgba(43,26,14,0.82); border: 2px solid #b88742; border-radius: 12px; padding: 18px 24px; text-align: center; width: 200px; pointer-events: auto; transform-origin: center bottom; }
#bbCommandMenuVisual { width: 64px; height: 64px; margin: 0 auto 6px; border-radius: 50%; overflow: hidden; background: #fff; border: 3px solid #b88742; }
#bbCommandMenuVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
#bbCommandMenuName { font-size: 14px; margin: 0 0 12px 0; color: #efdeb1; }
.bb-cmdMenuList { display: flex; flex-direction: column; gap: 8px; }
.bb-cmdMenuBtn { margin: 0; width: 100%; box-sizing: border-box; }
/* コマンドメニューが駒の位置から拡大されるように出現するアニメーション。 */
@keyframes bbCmdMenuPopIn {
    from { transform: translate(var(--bbCmdPopDx, 0px), var(--bbCmdPopDy, 0px)) scale(0.15); opacity: 0; }
    to { transform: translate(0px, 0px) scale(1); opacity: 1; }
}
#bbCommandMenuBox.bb-cmdMenuPopIn { animation: bbCmdMenuPopIn 0.28s cubic-bezier(0.2, 0.8, 0.3, 1.2); }

/* カレー準備画面：ボードバトルを開いた時の入口。登録済みロースターの一覧と
   カレー登録／戦闘開始／ヘルプの3ボタンだけを見せ、盤面はまだ表示しない。 */
#bbPrepPanel {
    position: absolute; inset: 0; z-index: 15; background: #2b1a0e; padding: 70px 14px 14px;
    overflow-y: auto; display: none;
}
#bbPrepPanel h2 { font-size: 14px; margin: 0 0 10px 0; color: #f5c469; }
#bbPrepCountLine { font-size: 11px; color: #b88742; margin-bottom: 8px; }
#bbPrepRankLine { font-size: 12px; color: #f1c40f; font-weight: bold; margin-bottom: 8px; }
/* 管理者（FEST_ADMIN_EXCLUDED_IDS本人）専用のランク直接設定UI。通常は非表示。 */
#bbAdminRankEditor { display: none; align-items: center; gap: 6px; margin-bottom: 8px; }
#bbAdminRankEditor select { font-size: 11px; padding: 2px 4px; }
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
#bbRegDetailBox { position: relative; background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px 22px; text-align: center; width: 250px; max-height: 82vh; overflow-y: auto; touch-action: pan-y; }
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

/* ランクアップ報酬（BETA） */
#bbRankRewardsOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbRankRewardsBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: left; width: 300px; max-height: 80vh; overflow-y: auto; }
#bbRankRewardsBox h3 { font-size: 15px; margin: 0 0 12px 0; color: #efdeb1; text-align: center; }
.bb-rankRewardRow {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px;
    border: 1px solid #6b4a26; background: #1c1108; margin-bottom: 6px;
}
.bb-rankRewardRow.bb-rankRewardLocked { opacity: 0.5; }
.bb-rankRewardName { font-size: 13px; font-weight: bold; color: #f1c40f; width: 28px; flex-shrink: 0; }
.bb-rankRewardDesc { font-size: 11px; color: #efdeb1; flex: 1; }

/* 対戦相手（敵AIタイプ）の選択 */
#bbOpponentSelectOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbOpponentSelectBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 300px; max-height: 80vh; overflow-y: auto; }
#bbOpponentSelectBox h3 { font-size: 15px; margin: 0 0 12px 0; color: #efdeb1; }
.bb-opponentBotCard {
    display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 10px;
    border-radius: 8px; border: 2px solid #6b4a26; background: #1c1108; text-align: left; margin-bottom: 8px;
}
.bb-opponentBotCard img { width: 48px; height: 48px; object-fit: contain; border-radius: 6px; background: #3a2712; flex-shrink: 0; }
.bb-opponentBotName { flex: 1; min-width: 0; font-weight: bold; font-size: 13px; color: #efdeb1; }

/* 配置プリセット（配置登録・配置呼出） */
#bbPlacementPresetOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbPlacementPresetBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 280px; max-height: 80vh; overflow-y: auto; }
#bbPlacementPresetBox h3 { font-size: 15px; margin: 0 0 8px 0; color: #efdeb1; }
#bbPlacementPresetHint { font-size: 11px; color: #b88742; margin-bottom: 12px; line-height: 1.5; }
#bbPlacementPresetList { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.bb-placementPresetRow {
    display: flex; align-items: center; gap: 8px; border: 2px solid #6b4a26; border-radius: 8px; background: #1c1108; padding: 8px 10px;
}
.bb-placementPresetInfo { flex: 1; text-align: left; cursor: pointer; }
.bb-placementPresetName { font-size: 13px; font-weight: bold; color: #efdeb1; }
.bb-placementPresetMeta { font-size: 10px; color: #b88742; margin-top: 2px; }
.bb-placementPresetDelBtn {
    background: none; border: 1px solid #6b4a26; color: #e74c3c; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; flex-shrink: 0;
}

/* カレー準備画面の簡易配置エディタ（#bbPrepPlacementEditorOverlay、z-index:9030）を開いた
   状態のまま「プリセット保存」を押しても、この名前入力ウインドウが必ず一番手前に出るよう、
   同じz-index帯の中でも一段高くしておく（同じz-indexだと後からDOMに置かれた方が上に来て
   しまい、エディタの下に隠れることがあった）。 */
#bbPlacementSaveNameOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9032;
}
#bbPlacementSaveNameBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 260px; }
#bbPlacementSaveNameBox h3 { font-size: 15px; margin: 0 0 10px 0; color: #efdeb1; }
#bbPlacementSaveNameInput {
    width: 100%; box-sizing: border-box; background: #1c1108; border: 1px solid #6b4a26; color: #efdeb1;
    border-radius: 6px; padding: 8px 10px; font-size: 13px; text-align: center; margin-bottom: 14px;
}

/* alert()ではなく、他のカードと見た目を合わせた簡易な通知ポップ（OKのみ・確認不要な
   お知らせ用）。showCustomConfirmのように確認/キャンセルの分岐は無いメッセージ向け。 */
#bbInfoPopupOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9040;
}
#bbInfoPopupBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 260px; }
#bbInfoPopupText { font-size: 13px; color: #efdeb1; margin-bottom: 14px; line-height: 1.5; white-space: pre-wrap; }

/* カレー準備画面の簡易配置エディタ：実際の盤面（3D・マス画像）は使わず、自陣の配置枠
   （旗の行を含む下2列＝2行×9列）だけをシンプルな平面グリッドで再現する。対戦相手や
   実際の3D盤面が無い状態でも、配置プリセット（配置登録・配置呼出）を組み立てられるように
   するためのもの。ここで使うマスのnodeId（row*BB_GRID_SIZE+col）は本編の盤面と同じ計算式
   なので、ここで作ったプリセットはそのまま実際の配置フェーズでも読み込める。 */
#bbPrepPlacementEditorOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9030;
}
#bbPrepPlacementEditorBox { background: #2b1a0e; border: 2px solid #b88742; border-radius: 12px; padding: 20px; text-align: center; width: 320px; max-height: 85vh; overflow-y: auto; }
#bbPrepPlacementEditorBox h3 { font-size: 15px; margin: 0 0 8px 0; color: #efdeb1; }
#bbPrepEditorHint { font-size: 11px; color: #b88742; margin-bottom: 8px; line-height: 1.5; text-align: left; }
#bbPrepEditorBudgetLine { font-size: 12px; margin-bottom: 8px; }
#bbPrepEditorBudgetLine.bb-over { color: #e74c3c; font-weight: bold; }
#bbPrepEditorGrid {
    display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; margin-bottom: 12px;
}
.bb-prepEditorCell {
    aspect-ratio: 1 / 1; border-radius: 4px; background: #1c1108; border: 2px solid #6b4a26;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; overflow: hidden; position: relative; padding: 1px;
}
.bb-prepEditorCell.bb-prepEditorCell-flag { background: #3a1414; border-color: #b88742; cursor: default; }
.bb-prepEditorCell.bb-prepEditorCell-selectable { border-color: #2ecc71; }
.bb-prepEditorCell.bb-prepEditorCell-occupied { border-color: #3498db; background: #142a3a; }
.bb-prepEditorCell-flagIcon { font-size: 14px; line-height: 1; color: #e74c3c; }
.bb-prepEditorCell img { width: 70%; height: 70%; object-fit: cover; border-radius: 50%; display: block; }
.bb-prepEditorCell-name {
    font-size: 7px; color: #efdeb1; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; line-height: 1.2;
}
#bbPrepEditorRosterList { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 14px; }

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
/* 本編の決闘画面は、敵画像の横に「対戦相手」名（#oppOwnerText）、その下の行
   （enemy-lower-row）に食材アイコン（#oppCurryEmojiText）とカレー名（#oppCurryNameText）を
   表示する。ボードバトルではstartExternalBoardBattle経由でoppN（#oppOwnerText用）に
   カレー名そのものを渡しているため、#oppOwnerTextと#oppCurryNameTextが同じ文字列で
   重複表示されてしまう。#battleArena.bb-arena-overlay（＝ボードバトルの決闘中のみ付与される
   クラス）に限定して#oppCurryNameTextを隠し、敵画像の下は食材アイコン4つのみが残るようにする
   （通常のPC対戦・オンライン対戦の見た目には一切影響しない。game.js自体は変更しない）。 */
#battleArena.bb-arena-overlay #oppCurryNameText {
    display: none;
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
const BB_TERRAIN_ROCK = 'rock';   // 岩マス：誰も進入・通過できない（隣接マスからわんぱくカレーが「攻撃」で破壊可能）
const BB_TERRAIN_WATER = 'water'; // 水マス：海の幸カレーのみ通過・停止できる
const BB_TERRAIN_POISON = 'poison'; // 毒マス：通過・停止で最大HP20%ダメージ（毒系カレーは無効）
// バナナマス：そんなバナナカレー（バナナトラップ）の効果で、トラップ設置フェーズにプレイヤーが
// 1マスだけ好きな場所に設置できる。他の特殊マスと違いランダム初期配置はされない（0個スタート）。
// 「必ず停止しなくてはならないマス」＝bbGetMovableNodeIdsでここを踏み台にした先への移動範囲を
// 打ち切ることで実現し、実際に乗ったらbbMoveUnitTo側でノーマルマスに戻す（踏んだら1回限り）。
const BB_TERRAIN_BANANA = 'banana';
const BB_SPECIAL_TILE_COUNT = 5; // 各特殊マスの初期配置数

// マス背景画像（通常／岩／水／毒／バナナ）。四角いマスに敷き詰めるようにxMidYMid sliceで表示する。
// 元はSVG（1枚あたり数千パス規模の複雑なベクター）だったが、81マス分を毎回再描画すると
// 重かったため、軽量なPNG（300x300）に差し替えている。
const BB_TILE_IMG_NORMAL = 'boardbattle/map01.png';
const BB_TILE_IMG_ROCK = 'boardbattle/map02.png';
const BB_TILE_IMG_WATER = 'boardbattle/map03.png';
const BB_TILE_IMG_POISON = 'boardbattle/map04.png';
const BB_TILE_IMG_BANANA = 'boardbattle/map05.png';
function bbGetTileImg(terrain) {
    if (terrain === BB_TERRAIN_ROCK) return BB_TILE_IMG_ROCK;
    if (terrain === BB_TERRAIN_WATER) return BB_TILE_IMG_WATER;
    if (terrain === BB_TERRAIN_POISON) return BB_TILE_IMG_POISON;
    if (terrain === BB_TERRAIN_BANANA) return BB_TILE_IMG_BANANA;
    return BB_TILE_IMG_NORMAL;
}

// コマ（コイン型トークン）をマス中心よりも少し上に描き、上部がマスから軽くはみ出て
// 「マスの上に立っている」ように見せるための引き上げ量(px)。
const BB_COIN_Y_LIFT = 14;

const BB_STAT_BUDGET = 3000;
const BB_MAX_UNITS = 12;

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

// 岩砕き：わんぱくカレー（isWanpaku）に加えて、3匹のわんぱく兄弟（isTonTonTon。本編では
// isWanpakuとは別の独立したフラグ）も同じく岩を砕ける。
function bbCanBreakRock(unit) { return !!(unit.raw && (unit.raw.isWanpaku || unit.raw.isTonTonTon)); }
function bbCanCrossWater(unit) { return !!(unit.raw && unit.raw.isSeafood); }
function bbIsPoisonImmune(unit) { return !!(unit.raw && (unit.raw.isPoison || unit.raw.isPoisonApple)); }
// 種カレー（isSeed）：移動後、隣接に限らず直線3マス以内の敵駒1体を対象に「種発射」で
// 攻撃できる（本編の対戦カットインは使わず、通常攻撃1回分のダメージだけをその場で与える）。
function bbIsSeedShooter(unit) { return !!(unit.raw && unit.raw.isSeed); }
// 種発射の対象が盾カレー（貝の盾＝isKaiTate）の場合は完全ガードでダメージ0。
function bbHasSeedGuard(unit) { return !!(unit.raw && unit.raw.isKaiTate); }
// 種発射の対象がホームランカレー（isHomerun）の場合も打ち返してダメージ0。
function bbIsHomerunCurry(unit) { return !!(unit.raw && unit.raw.isHomerun); }
// 激辛エスニック・グリーンカレー（isGreenCurry）：特技「ヒリヒリクラッシュ」＝コマンドで選択すると
// 自分と上下左右の駒全て（敵味方関係なし）に50ダメージ。
function bbHasHiriHiri(unit) { return !!(unit.raw && unit.raw.isGreenCurry); }
// そんなバナナカレー（本編でのフラグ名はisBananaCurry。isBananaではない点に注意）：
// 特技「バナナトラップ」＝配置フェーズとゲーム開始の間にトラップ設置フェーズが追加され、
// 好きなノーマルマス1つをバナナマスに変更できる。
function bbHasBananaTrap(unit) { return !!(unit.raw && unit.raw.isBananaCurry); }
// ネバネバカレー（isSticky）：特技「ネバネバクダン」＝隣接する敵1体に通常攻撃＋1回休みを
// 付与できる（戦闘中1回のみ使用可）。unit.bbUsedNebaNebaで使用済みかどうかを個体ごとに管理する
// （盤上の駒オブジェクトは対戦開始のたびに作り直されるため、対戦をまたいで残ることはない）。
function bbHasNebaNebaKudan(unit) { return !!(unit.raw && unit.raw.isSticky && !unit.bbUsedNebaNeba); }
// 太陽のラタトゥイユカレー（isRatatouille）：特技「太陽の恵み」＝行動順が回ってきた時に
// 最大HPの20%を自動回復する常時パッシブ。
function bbHasSunBlessing(unit) { return !!(unit.raw && unit.raw.isRatatouille); }
// ふわとろオムカレー（isFluffyOmelette）：特技「ふわとろバリア」＝自分と隣接する仲間が、
// 盤上の技（種発射・ヒリヒリクラッシュ・ネバネバクダン等）で受けるダメージを50%にする常時パッシブ。
function bbHasFluffyBarrier(unit) { return !!(unit.raw && unit.raw.isFluffyOmelette); }
// defenderが受ける盤上技のダメージ倍率を返す（ふわとろバリアの影響を受けるなら0.5、
// それ以外は1）。defender自身がふわとろバリア持ちの場合に加えて、隣接する生存中の
// 味方（同チーム）がふわとろバリアを持っている場合も軽減の対象になる。
function bbGetFluffyBarrierMultiplier(defender) {
    if (!defender) return 1;
    if (bbHasFluffyBarrier(defender)) return 0.5;
    const node = bbNodesById[defender.nodeId];
    if (node) {
        const hasNearbyBarrier = node.neighbors.some(nid => {
            const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0 && u.team === defender.team);
            return occupant && bbHasFluffyBarrier(occupant);
        });
        if (hasNearbyBarrier) return 0.5;
    }
    return 1;
}

// ------------------------------------------------------------
// 8.05 特技・特性の定義
//    駒の詳細カード・カレー準備画面の詳細・コマンドメニュー・ヘルプ文言（「カレーボードバトル
//    とは？」）で共通して使う、名前と説明文の一元管理テーブル。
//    active:true は「特技」コマンドとして選択できる能動的な技（種発射・岩砕き）、
//    active:falseは自動的に働く受動的な特性（水泳・ホームラン・盾ガード・毒耐性）。
// ------------------------------------------------------------
const BB_SKILLS = [
    { key: 'seed', name: '種発射', desc: '直線3マス以内の敵への遠距離攻撃', active: true, test: bbIsSeedShooter },
    { key: 'wanpaku', name: '岩砕き', desc: '隣接する岩を砕く', active: true, test: bbCanBreakRock },
    { key: 'seafood', name: '水泳', desc: '水マスを通過・停止できる', active: false, test: bbCanCrossWater },
    { key: 'homerun', name: 'ホームラン', desc: '特定の攻撃を無効化', active: false, test: bbIsHomerunCurry },
    { key: 'kaitate', name: '盾ガード', desc: '特定の攻撃を無効化', active: false, test: bbHasSeedGuard },
    { key: 'poison', name: '毒耐性', desc: '毒マスのダメージを受けない', active: false, test: bbIsPoisonImmune },
    { key: 'hirihiri', name: 'ヒリヒリクラッシュ', desc: '自分と上下左右の全ての駒に50ダメージ', active: true, test: bbHasHiriHiri },
    // トラップ設置は戦闘中のコマンドではなく配置後の専用フェーズで行うため、
    // 「特技」コマンドの対象にはしない（active:falseの他の受動特性と同じ扱い）。
    { key: 'banana', name: 'バナナトラップ', desc: 'バナナトラップを設置できる。', active: false, test: bbHasBananaTrap },
    { key: 'nebaneba', name: 'ネバネバクダン', desc: '1度だけダメージ+1回休みを付与できる。', active: true, test: bbHasNebaNebaKudan },
    { key: 'sunblessing', name: '太陽の恵み', desc: '毎ターンHPを少し回復。', active: false, test: bbHasSunBlessing },
    { key: 'fluffybarrier', name: 'ふわとろバリア', desc: '自分と隣接する仲間のダメージを軽減', active: false, test: bbHasFluffyBarrier }
];
// unit（{raw:カレー本体}の形）・カレー本体（raw）そのもの、どちらを渡しても判定できるようにする
// （盤面の駒はunit形、カレー準備画面の登録カレーはbbGetEffectiveCurry()の戻り値＝raw形のため）。
function bbGetSkillsFor(unitOrCurry) {
    if (!unitOrCurry) return [];
    const asUnit = ('raw' in unitOrCurry) ? unitOrCurry : { raw: unitOrCurry };
    return BB_SKILLS.filter(s => s.test(asUnit));
}
// 「特技」コマンド（能動的な技のみ）に絞ったバージョン。
function bbGetActiveSkillsFor(unitOrCurry) {
    return bbGetSkillsFor(unitOrCurry).filter(s => s.active);
}
// 駒の詳細カード・カレー準備画面の詳細で共通して使う、技一覧のHTMLを組み立てる。
function bbRenderSkillsHtml(unitOrCurry) {
    const skills = bbGetSkillsFor(unitOrCurry);
    if (skills.length === 0) {
        return '<div class="bb-skillList"><span class="bb-skillNone">使用できる技はありません。</span></div>';
    }
    const rows = skills.map(s => `<div class="bb-skillRow"><span class="bb-skillName">${bbEsc(s.name)}</span><span class="bb-skillDesc">${bbEsc(s.desc)}</span></div>`).join('');
    return `<div class="bb-skillList">${rows}</div>`;
}

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
// カレーの「調理ルール由来」の特殊フラグ一覧。本編の調理ロジック（generateRandomCurryFromPool等）
// が食材の組み合わせから正しく立てるものなので、この一覧に含まれるフラグを既に持っている
// カレーへ、別のフラグを無理やり追加で立ててしまうと、実際には作れない組み合わせ
// （例：わんぱく要素ゼロの「種連発トンカツナスレンコンカレー」が水泳を持つ、等）が
// 生まれてしまう。bbGenerateEnemyTeamWithForcedの強制付与で、これを避けるために使う。
const BB_SPECIAL_FLAG_KEYS = ['isWanpaku', 'isSeafood', 'isSeed', 'isHomerun', 'isKaitate', 'isPoison', 'isPoisonApple', 'isGreenCurry', 'isBananaCurry', 'isTonTonTon', 'isSticky', 'isRatatouille', 'isFluffyOmelette'];
function bbCountSpecialFlags(c) {
    return BB_SPECIAL_FLAG_KEYS.filter(k => !!c[k]).length;
}
// 「特定の条件（種カレー・わんぱく等のフラグ、SPD条件など）を必須で含む」対戦相手ボット用の
// チーム生成。forcedSpecs=[{test:c=>boolean, force:c=>void, count:number}, ...]の順に、
// 条件を満たすカレーが出るまで実際の調理ロジックで繰り返し生成を試みる（最大40回）。
// それでも自然には出なかった場合、他の特殊フラグを一切持たない「無地」なカレーが40回の
// 試行中に1つでもあれば、そのカレーへ直接フラグを立てる（他の特殊フラグと衝突しないように
// するため）。無地な候補が無かった場合のみ、やむを得ず最後に生成したカレーへ強制的に
// フラグを立てる（見た目には他のカレーと同じくランダム生成のまま）。残り枠は通常の
// ランダム生成で埋める。
function bbGenerateEnemyTeamWithForced(forcedSpecs) {
    const team = [];
    let remaining = BB_STAT_BUDGET;
    // 必須条件（forcedSpecs）で指定されたカレーは、そのボットの編成として「必ず」含まれる
    // 必要があるため、通常の予算チェック（total<=remaining）を通さずに無条件で加える
    // （必須分だけで予算を超えることもあり得るが、対戦バランスよりも指定の再現を優先する）。
    (forcedSpecs || []).forEach(function (spec) {
        for (let i = 0; i < spec.count && team.length < BB_MAX_UNITS; i++) {
            let curry = null;
            let neutralCandidate = null; // 他の特殊フラグを持たない、強制付与しても安全な候補
            for (let attempt = 0; attempt < 40; attempt++) {
                curry = bbGenerateDebugCurry();
                if (spec.test(curry)) break;
                if (!neutralCandidate && bbCountSpecialFlags(curry) === 0) neutralCandidate = curry;
            }
            if (curry && !spec.test(curry) && typeof spec.force === 'function') {
                // 既に他の特技フラグを持つカレーへ上書きしてしまうと、実際の調理では
                // ありえない組み合わせになるため、無地な候補があればそちらを優先して使う。
                if (neutralCandidate) curry = neutralCandidate;
                spec.force(curry);
            }
            if (curry) {
                team.push(curry);
                remaining -= bbStatTotal(curry);
            }
        }
    });
    // 残り枠は通常のランダム生成で埋める（予算を超えない範囲で1体ずつ積み増す、既存ロジックと同じ）。
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
// 全員が特定条件（SPD100以上など）を満たす必要があるボット用の版。「必須で足りない分を無条件で
// 足す」forcedSpecsとは違い、こちらは条件を満たすカレーだけを対象に、通常のbbGenerateDebugEnemyTeam
// と同じ予算内で1体ずつ積み増していく（全員が条件を満たしたまま、対戦バランスの予算は維持する）。
function bbGenerateEnemyTeamFiltered(test, force) {
    const team = [];
    let remaining = BB_STAT_BUDGET;
    let attempts = 0;
    while (team.length < BB_MAX_UNITS && attempts < 50 && (team.length === 0 || remaining > 150)) {
        attempts++;
        let curry = null;
        for (let attempt = 0; attempt < 40; attempt++) {
            curry = bbGenerateDebugCurry();
            if (test(curry)) break;
        }
        if (curry && !test(curry) && typeof force === 'function') force(curry);
        if (!curry) continue;
        const total = bbStatTotal(curry);
        if (total <= remaining || team.length === 0) {
            team.push(curry);
            remaining -= total;
        }
    }
    return team;
}

// ------------------------------------------------------------
// 4.3.5 対戦相手ボット（4体固定・画像付き）の定義
//    行動パターン（mode）は、既存の3種類の敵AI挙動（bbPerformEnemyTurn参照）
//    straight=旗に近づく優先／combat=敵と戦う優先／random=毎ターンどちらかをランダム、
//    をそのまま流用する。
// ------------------------------------------------------------
const BB_OPPONENT_BOTS = [
    {
        key: 'negita',
        name: '新入部員 ネギ太',
        img: 'boardbattle/boardbot01.png',
        desc: '使用カレー：ランダムに生成／行動：「旗に近づく」「敵と戦う」をランダム',
        mode: 'random',
        buildTeam: function () { return bbGenerateDebugEnemyTeam(); }
    },
    {
        key: 'kurukku',
        name: '部員 くるっくちゃん',
        img: 'boardbattle/boardbot02.png',
        desc: '使用カレー：SPD100以上のカレーのみ／行動：「旗に近づく」を優先',
        mode: 'straight',
        buildTeam: function () {
            return bbGenerateEnemyTeamFiltered(
                function (c) { return (c.spd || 0) >= 100; },
                function (c) { c.spd = 100; }
            );
        }
    },
    {
        key: 'yasutomoro',
        name: '副部長 安富呂',
        img: 'boardbattle/boardbot03.png',
        desc: '使用カレー：種カレー3体・ホームランカレー2体・毒カレー1体は必須／行動：「旗に近づく」「敵と戦う」をランダム',
        mode: 'random',
        buildTeam: function () {
            return bbGenerateEnemyTeamWithForced([
                { test: function (c) { return !!c.isSeed; }, force: function (c) { c.isSeed = true; }, count: 3 },
                { test: function (c) { return !!c.isHomerun; }, force: function (c) { c.isHomerun = true; }, count: 2 },
                { test: function (c) { return !!(c.isPoison || c.isPoisonApple); }, force: function (c) { c.isPoison = true; }, count: 1 }
            ]);
        }
    },
    {
        key: 'erisa',
        name: '部長 エリサ',
        img: 'boardbattle/boardbot04.png',
        desc: '使用カレー：グリーンカレー2体・海の幸2体・種カレー3体は必須（残りはランダムに生成）／行動：「敵と戦う」を優先',
        mode: 'combat',
        buildTeam: function () {
            return bbGenerateEnemyTeamWithForced([
                { test: function (c) { return !!c.isGreenCurry; }, force: function (c) { c.isGreenCurry = true; }, count: 2 },
                { test: function (c) { return !!c.isSeafood; }, force: function (c) { c.isSeafood = true; }, count: 2 },
                { test: function (c) { return !!c.isSeed; }, force: function (c) { c.isSeed = true; }, count: 3 }
            ]);
        }
    }
];

function bbGetCurryImg(curry) {
    return (typeof getCurryImage === 'function') ? getCurryImage(curry) : '';
}
// 本編（game.js）のplaySoundEffect(path)をそのまま利用する（ミュート設定・SEプール管理も
// 本編側に任せられる）。本編が読み込まれていない環境でも落ちないようtypeofで守る。
function bbPlaySfx(path) {
    if (typeof playSoundEffect === 'function') {
        try { playSoundEffect(path); } catch (e) { /* 効果音の再生に失敗しても対戦の進行は止めない */ }
    }
}
// 本編（game.js）のplayBattleBGM(path)/stopBattleBGM()をそのまま利用する（ループ再生・
// ミュート判定・音量・多重再生防止まで本編側に任せられる。「PCと対戦」の戦闘BGMと同じ仕組み）。
function bbPlayBattleBgm(path) {
    if (typeof playBattleBGM === 'function') {
        try { playBattleBGM(path); } catch (e) { /* BGM再生に失敗しても対戦の進行は止めない */ }
    }
}
function bbStopBattleBgm() {
    if (typeof stopBattleBGM === 'function') {
        try { stopBattleBGM(); } catch (e) { /* 何もしない */ }
    }
}
// 本編ヘッダーの#muteBtn／toggleMute()／isMutedをそのまま流用する（#bookBattleMuteBtnと
// 同じ考え方：二重管理はせず、ボードバトル側のアイコンだけ同期させる）。
function bbToggleMute() {
    if (typeof toggleMute === 'function') { try { toggleMute(); } catch (e) {} }
    bbUpdateMuteIcon();
}
function bbUpdateMuteIcon() {
    const icon = document.getElementById('bbMuteIcon');
    if (!icon) return;
    const muted = (typeof isMuted !== 'undefined') && isMuted;
    icon.src = muted ? 'sound-off.svg' : 'sound-on.svg';
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
    // battleフェーズ中のプレイヤー手番のサブ状態：
    // 'move'（移動先選択・コマンドメニューを開く前）| 'menu'（コマンドメニュー表示中）|
    // 'action'（「戦闘を挑む」「特技」を選んだ後の対象選択）
    subPhase: null,
    hasMovedThisTurn: false, // このターン中に既に移動したか（1ターンに1回だけ移動できる）
    pendingCommandMode: null, // 'action'サブフェーズ中の対象選択が「戦闘を挑む(melee)」か「特技(skill)」かの区別
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

// ------------------------------------------------------------
// 3.6 配置プリセット（配置登録・配置呼出）
//    盤面の配置（どのカレーをどのマスへ置いたか）を名前付きで最大5件まで保存できる。
//    プリセット1件は「登録済みカレーのregId（安定ID）とnodeIdの組」の配列として持つ
//    （bbState.playerPool自体は配置フェーズに入るたびに作り直される一時オブジェクトの
//    配列なので、そのインデックスやオブジェクト参照そのものは保存に使えない。
//    bbRegisteredRosterの各エントリが持つregIdだけが、時間が経っても変わらない識別子）。
// ------------------------------------------------------------
const BB_PLACEMENT_PRESET_STORAGE_KEY = 'qr_board_battle_placement_presets';
const BB_PLACEMENT_PRESET_MAX = 5;
let bbPlacementPresets = [];
function bbLoadPlacementPresets() {
    try {
        const raw = localStorage.getItem(BB_PLACEMENT_PRESET_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        bbPlacementPresets = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('[ボードバトル] 配置プリセットの読み込みに失敗:', e);
        bbPlacementPresets = [];
    }
}
function bbSavePlacementPresets() {
    try {
        localStorage.setItem(BB_PLACEMENT_PRESET_STORAGE_KEY, JSON.stringify(bbPlacementPresets));
    } catch (e) {
        console.warn('[ボードバトル] 配置プリセットの保存に失敗:', e);
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
    ['bbResultOverlay', 'bbUnitDetailOverlay', 'bbCommandMenuOverlay', 'bbRegisterPickerOverlay', 'bbRegDetailOverlay', 'bbHelpOverlay', 'bbOpponentSelectOverlay', 'bbPlacementPresetOverlay', 'bbPlacementSaveNameOverlay', 'bbInfoPopupOverlay', 'bbPrepPlacementEditorOverlay', 'bbRankRewardsOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// カレーボードバトルを開いた時・「バトルボードに戻る」で戻ってきた時の初期画面＝カレー準備画面。
// （盤面はまだ表示せず、登録済みカレーの一覧と「カレー登録」「戦闘開始」だけを見せる）
function bbInit() {
    bbLoadRegisteredRoster();
    bbLoadRankState();
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
    // 敵の出撃予定プレビュー帯（配置フェーズ専用）も同様に隠す。
    const enemyPreviewBarElPrep = document.getElementById('bbEnemyPreviewBar');
    if (enemyPreviewBarElPrep) enemyPreviewBarElPrep.style.display = 'none';
    // 対戦相手バナー（配置・戦闘フェーズ専用）も、準備画面ではまだ相手が決まっていないため隠す。
    const opponentBannerElPrep = document.getElementById('bbOpponentBanner');
    if (opponentBannerElPrep) opponentBannerElPrep.style.display = 'none';
    bbUpdateHeaderCloseBtnLabel();
    bbUpdateMuteIcon();
    bbRenderPrepPanel();
}

// 盤面上部（ヘッダー下）に、選択中の対戦相手ボットのイラストと名前を表示する。
// 配置フェーズ開始時に一度描画すれば、その後の戦闘フェーズでも同じ内容のまま表示され続ける
// （対戦相手は配置フェーズに入る前に確定しており、対戦中に変わることはないため）。
function bbRenderOpponentBanner() {
    const banner = document.getElementById('bbOpponentBanner');
    const img = document.getElementById('bbOpponentBannerImg');
    const nameEl = document.getElementById('bbOpponentBannerName');
    if (!banner || !img || !nameEl) return;
    const bot = bbSelectedOpponentBot;
    if (!bot) { banner.style.display = 'none'; return; }
    img.src = bot.img;
    nameEl.textContent = bot.name;
    banner.style.display = 'flex';
    bbPositionOpponentBanner();
}

// 準備画面の「戦闘開始」で呼ばれる：盤面を表示し、登録済みロースターを配置候補として配置フェーズへ。
function bbEnterPlacementPhase() {
    bbCleanupLeakedTempCurries();
    bbLoadPlacementPresets();
    bbBuildBoard();
    bbGenerateSpecialTiles(); // 岩・水・毒マスをランダムに5マスずつ配置（自陣旗→敵旗の経路は必ず確保する）
    bbState.phase = 'placement';
    bbState.playerPool = bbRegisteredRoster.map(bbGetEffectiveCurry);
    bbState.enemyPool = bbSelectedOpponentBot ? bbSelectedOpponentBot.buildTeam() : bbGenerateDebugEnemyTeam();
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
    const trapPanelElPlacement = document.getElementById('bbTrapPanel');
    if (trapPanelElPlacement) trapPanelElPlacement.style.display = 'none';
    document.getElementById('bbBattleLog').innerHTML = '';
    // 配置フェーズでもまだ行動順は無いので、帯は隠したまま（戦闘開始で改めて表示する）。
    // その代わりに、同じ位置へ敵の出撃予定カレーのプレビュー帯を表示する。
    const turnQueueBarElPlacement = document.getElementById('bbTurnQueueBar');
    if (turnQueueBarElPlacement) turnQueueBarElPlacement.style.display = 'none';
    const enemyPreviewBarElPlacement = document.getElementById('bbEnemyPreviewBar');
    if (enemyPreviewBarElPlacement) enemyPreviewBarElPlacement.style.display = 'flex';
    bbRenderEnemyPreviewBar();
    bbRenderOpponentBanner();
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
let bbSelectedOpponentBot = BB_OPPONENT_BOTS[0];
function bbShowOpponentSelect() {
    bbRenderOpponentSelectList();
    const el = document.getElementById('bbOpponentSelectOverlay');
    if (el) el.style.display = 'flex';
}
function bbCloseOpponentSelect() {
    const el = document.getElementById('bbOpponentSelectOverlay');
    if (el) el.style.display = 'none';
}
// 対戦相手選択：4体の固定ボットを画像と名前だけで一覧表示する
// （使用カレーの内訳や行動パターンの説明文はここでは出さない）。
function bbRenderOpponentSelectList() {
    const list = document.getElementById('bbOpponentSelectList');
    if (!list) return;
    list.innerHTML = BB_OPPONENT_BOTS.map(function (bot, idx) {
        return `<div class="bb-opponentBotCard" onclick="window.__bbSelectOpponentBot(${idx})">
            <img src="${bbEsc(bot.img)}" alt="">
            <div class="bb-opponentBotName">${bbEsc(bot.name)}</div>
        </div>`;
    }).join('');
}
function bbSelectOpponentBot(idx) {
    const bot = BB_OPPONENT_BOTS[idx];
    if (!bot) return;
    bbSelectedOpponentBot = bot;
    bbSelectedOpponentType = bot.mode;
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

// 敵バナー（画像+名前）を#bbBoardWrapの中に置きつつ、盤面と全く同じtranslate/scale
// （bbViewportGに適用しているのと同じ計算式）を自前で当てることで、SVG内部の駒などと
// 同じ「盤の階層」にいるかのように、パン・ズームと連動して敵陣の旗の少し上に浮かび続ける
// ようにする（SVGの中に直接置くと3D傾き(rotateX)で名前の文字も傾いて読みにくくなるため、
// あえてSVGの外＝#bbBoardWrap直下のHTML要素として、同じ変形だけを計算して当てている）。
function bbPositionOpponentBanner() {
    const el = document.getElementById('bbOpponentBanner');
    if (!el) return;
    const worldX = BB_COL_X[BB_FLAG_COL];
    const worldY = BB_ROW_Y_TOP - BB_NODE_HALF - 10; // 旗マスの少し上
    const screenX = worldX * bbView.scale + bbView.x;
    const screenY = worldY * bbView.scale + bbView.y;
    el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%) scale(${bbView.scale})`;
}
function bbApplyView() {
    const g = document.getElementById('bbViewportG');
    if (g) g.setAttribute('transform', `translate(${bbView.x},${bbView.y}) scale(${bbView.scale})`);
    bbPositionOpponentBanner();
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

// コマ＝厚みのあるコイン型トークンを描く。上面（cx,cy中心の円）にカレーイラストを
// クリップ表示し、その少し下に側面色（自陣＝青／敵陣＝赤）の円を重ねてずらすことで、
// 円柱のように厚みのある側面が下側にだけ覗いているように見せる。
// clipKeyは同じSVG内でclipPath idが重複しないようにするための一意な文字列。
function bbCoinMarkup(cx, cy, r, team, imgSrc, clipKey) {
    const rim = (team === 'player') ? '#3aa0e6' : '#e5564a';
    const rimDeep = (team === 'player') ? '#1d5c8f' : '#8f261d';
    const rimH = Math.max(3, Math.round(r * 0.34)); // コインの厚み（側面の高さ）
    const clipId = `bbCoinClip${clipKey}`;
    let s = '';
    // 側面（厚み）：奥（暗い色）→手前（明るい色）の順で少しずつ下にずらして重ね、
    // 上面の縁からだけ色帯がのぞく円柱のように見せる。
    s += `<circle class="bb-coin-side" cx="${cx}" cy="${cy + rimH}" r="${r}" fill="${rimDeep}"></circle>`;
    s += `<circle class="bb-coin-side" cx="${cx}" cy="${cy + rimH * 0.55}" r="${r}" fill="${rim}"></circle>`;
    // 上面：カレーイラスト＋チーム色のリング
    s += `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"></circle></clipPath></defs>`;
    s += `<circle class="bb-coin-top-bg" cx="${cx}" cy="${cy}" r="${r}"></circle>`;
    s += `<image href="${imgSrc}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
    s += `<circle class="bb-coin-top-ring" cx="${cx}" cy="${cy}" r="${r}" stroke="${rim}"></circle>`;
    return s;
}

// 移動後の行動選択フェーズ用：行動主(fromNode)から対象マス(toNode)へ向かって
// 進んでいくように見える矢印（三角形）を対象マス寄りに描く。CSS側は上下左右
// 4方向ぶんの march アニメーションを用意しているだけなので、ここでは実際の向き
// （dx/dyの符号）から該当するクラス名を選ぶ。
function bbAttackArrowMarkup(fromNode, toNode) {
    if (!fromNode || !toNode) return '';
    const dx = toNode.x - fromNode.x, dy = toNode.y - fromNode.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const pullBack = 16; // 対象マスの中心から、出発地側へ少し引いた位置に矢印を置く
    const cx = toNode.x - ux * pullBack, cy = toNode.y - uy * pullBack;
    const s = 8;
    const tipX = cx + ux * s, tipY = cy + uy * s;
    const baseCx = cx - ux * s, baseCy = cy - uy * s;
    const px = -uy, py = ux; // 進行方向に垂直なベクトル（底辺の広がり方向）
    const b1x = baseCx + px * s, b1y = baseCy + py * s;
    const b2x = baseCx - px * s, b2y = baseCy - py * s;
    let dirClass;
    if (Math.abs(dy) >= Math.abs(dx)) dirClass = (dy < 0) ? 'bb-arrow-up' : 'bb-arrow-down';
    else dirClass = (dx < 0) ? 'bb-arrow-left' : 'bb-arrow-right';
    return `<polygon class="bb-attack-arrow ${dirClass}" points="${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}"></polygon>`;
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
        if (n.highlight === 'trapSelectable') cls += ' bb-trapSelectable';
        if (isActive) cls += ' bb-active-turn';
        // 詳細カード表示中の駒の移動可能範囲プレビュー（自分の手番の移動可能ハイライトとは別枠）。
        if (n.moveHighlight === 'player') cls += ' bb-move-preview-player';
        else if (n.moveHighlight === 'enemy') cls += ' bb-move-preview-enemy';
        html += `<g onclick="window.__bbOnNodeClick(${n.id})">`;
        if (isActive) {
            const ringHalf = BB_NODE_HALF + 4;
            html += `<rect class="bb-active-ring" x="${n.x - ringHalf}" y="${n.y - ringHalf}" width="${ringHalf * 2}" height="${ringHalf * 2}"></rect>`;
        }
        // マスの背景画像（通常／岩／水／毒）。地形ごとの画像を敷き詰め、その上にハイライト用の
        // 枠線（fill:noneのrect＝cls）を重ねる。
        html += `<image class="bb-board-tile-img" href="${bbGetTileImg(n.terrain)}" x="${n.x - BB_NODE_HALF}" y="${n.y - BB_NODE_HALF}" width="${BB_NODE_HALF * 2}" height="${BB_NODE_HALF * 2}" preserveAspectRatio="xMidYMid slice"></image>`;
        html += `<rect id="bbTile${n.id}" class="${cls}" x="${n.x - BB_NODE_HALF}" y="${n.y - BB_NODE_HALF}" width="${BB_NODE_HALF * 2}" height="${BB_NODE_HALF * 2}"></rect>`;
        if (isFlag && !unit) {
            html += bbFlagMarkup(n.x, n.y, n.row === BB_ROW_TOP ? '#e74c3c' : '#3498db');
        }
        if (unit) {
            const r2 = BB_NODE_R - 4;
            // マス中心よりも少し上（BB_COIN_Y_LIFT）にコインを描き、上部がマスから軽く
            // はみ出て「マスの上に立っている」ように見せる。
            html += bbCoinMarkup(n.x, n.y - BB_COIN_Y_LIFT, r2, unit.team, bbGetCurryImg(unit.raw), `n${n.id}`);
            const pct = Math.max(0, unit.hp / unit.maxHp);
            const barW = BB_NODE_HALF * 1.6;
            // HPバーはマスの外（下の行のマス絵に隠れてしまう）にはみ出さないよう、
            // コインを引き上げてできた隙間（コイン下端〜マス下端の間）に収める。
            const coinBottomY = n.y - BB_COIN_Y_LIFT + r2;
            const barY = coinBottomY + 4;
            html += `<rect class="bb-board-hp-bg" x="${n.x - barW / 2}" y="${barY}" width="${barW}" height="5" rx="2"></rect>`;
            html += `<rect class="bb-board-hp-fill" x="${n.x - barW / 2}" y="${barY}" width="${barW * pct}" height="5" rx="2"></rect>`;
            // ネバネバクダンで「1回休み」になっている駒には、行動順が回ってくるまでの間、
            // コインの右上あたりに常時❌マークを重ねて表示する。
            if (unit.bbSkipNextTurn) {
                html += `<text class="bb-skip-badge" x="${n.x + r2 * 0.6}" y="${n.y - BB_COIN_Y_LIFT - r2 * 0.6}">❌</text>`;
            }
        }
        // 行動選択フェーズ中、攻撃対象（隣接する敵駒・岩）のマスへ、行動主から向かって
        // 進んでいくように見える矢印を重ねて表示する。
        if (n.highlight === 'attackable' && bbState.activeUnit) {
            html += bbAttackArrowMarkup(bbNodesById[bbState.activeUnit.nodeId], n);
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
        alert('配置できるのは最大12体までです。');
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
    if (bbState.phase === 'trap') {
        bbOnTrapNodeClick(nodeId);
        return;
    }
    if (bbState.phase === 'battle') {
        bbOnBattleNodeClick(nodeId);
    }
}

// ------------------------------------------------------------
// 6.5 配置プリセット（配置登録・配置呼出）
// ------------------------------------------------------------
// 「配置登録」ボタン：今配置中の内容を名前付きで保存する。5件登録済みなら、まず
// 削除する1件を選ばせてから登録名の入力に進む。
function bbOnSavePlacementClick() {
    if (bbState.phase !== 'placement') return;
    const placed = bbState.units.filter(u => u.team === 'player');
    if (placed.length === 0) {
        alert('配置されているカレーがありません。');
        return;
    }
    bbPlacementSaveSource = 'battle';
    if (bbPlacementPresets.length >= BB_PLACEMENT_PRESET_MAX) {
        bbShowPlacementPresetOverlay('deleteForSave');
        return;
    }
    bbShowPlacementSaveNameOverlay();
}
// 「配置呼出」ボタン：登録済みの配置一覧を開く。
function bbOnLoadPlacementClick() {
    if (bbState.phase !== 'placement') return;
    if (bbPlacementPresets.length === 0) {
        alert('登録済みの配置がありません。');
        return;
    }
    bbShowPlacementPresetOverlay('load');
}

// 「配置登録」の保存元。'battle'なら実際の配置フェーズ（bbState.units）から、
// 'prepEditor'ならカレー準備画面の簡易配置エディタ（bbPrepEditorPlacements）から保存する。
let bbPlacementSaveSource = 'battle';
// 一覧オーバーレイは「配置呼出」（本編の配置フェーズ／準備画面の簡易エディタの2箇所から使う）と
// 「登録上限に達した時の削除選択」の計3つのモードを兼ねる。
let bbPlacementPresetMode = 'load'; // 'load' | 'loadToPrepEditor' | 'deleteForSave'
function bbShowPlacementPresetOverlay(mode) {
    bbPlacementPresetMode = mode;
    bbRenderPlacementPresetList();
    const el = document.getElementById('bbPlacementPresetOverlay');
    if (el) el.style.display = 'flex';
}
function bbClosePlacementPresetOverlay() {
    const el = document.getElementById('bbPlacementPresetOverlay');
    if (el) el.style.display = 'none';
}
function bbRenderPlacementPresetList() {
    const titleEl = document.getElementById('bbPlacementPresetTitle');
    const hintEl = document.getElementById('bbPlacementPresetHint');
    const listEl = document.getElementById('bbPlacementPresetList');
    if (!listEl) return;
    if (bbPlacementPresetMode === 'deleteForSave') {
        if (titleEl) titleEl.textContent = '配置は5件まで登録できます';
        if (hintEl) hintEl.textContent = '削除する配置を選んでください（選ぶとすぐに削除され、新しい配置の登録名の入力に進みます）。';
    } else if (bbPlacementPresetMode === 'loadToPrepEditor') {
        if (titleEl) titleEl.textContent = '配置を呼び出す';
        if (hintEl) hintEl.textContent = '呼び出す配置を選んでください（下の簡易エディタの配置は上書きされます）。ゴミ箱ボタンで削除もできます。';
    } else {
        if (titleEl) titleEl.textContent = '配置を呼び出す';
        if (hintEl) hintEl.textContent = '呼び出す配置を選んでください（現在盤面に配置している自陣のカレーは上書きされます）。ゴミ箱ボタンで削除もできます。';
    }
    if (bbPlacementPresets.length === 0) {
        listEl.innerHTML = '<div style="font-size:11px;color:#b88742;">登録済みの配置がありません。</div>';
        return;
    }
    listEl.innerHTML = bbPlacementPresets.map((p, idx) => {
        const delBtn = (bbPlacementPresetMode === 'load' || bbPlacementPresetMode === 'loadToPrepEditor')
            ? `<button class="bb-placementPresetDelBtn" onclick="window.__bbOnDeletePlacementPreset(${idx})">削除</button>`
            : '';
        return `<div class="bb-placementPresetRow">
            <div class="bb-placementPresetInfo" onclick="window.__bbOnPlacementPresetRowClick(${idx})">
                <div class="bb-placementPresetName">${bbEsc(p.name)}</div>
                <div class="bb-placementPresetMeta">${(p.slots || []).length}体配置</div>
            </div>
            ${delBtn}
        </div>`;
    }).join('');
}
function bbOnPlacementPresetRowClick(idx) {
    const preset = bbPlacementPresets[idx];
    if (!preset) return;
    if (bbPlacementPresetMode === 'deleteForSave') {
        const doDelete = function () {
            bbPlacementPresets.splice(idx, 1);
            bbSavePlacementPresets();
            bbClosePlacementPresetOverlay();
            bbShowPlacementSaveNameOverlay();
        };
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('配置を削除', `「${bbEsc(preset.name)}」を削除して、新しい配置の登録に進みますか？`, doDelete);
        } else {
            doDelete();
        }
        return;
    }
    // 呼出モード：確認なしでそのまま読み込む（現在の配置は上書きされる）。
    bbClosePlacementPresetOverlay();
    if (bbPlacementPresetMode === 'loadToPrepEditor') {
        bbApplyPresetToPrepEditor(preset);
    } else {
        bbApplyPlacementPreset(preset);
    }
}
function bbOnDeletePlacementPreset(idx) {
    const preset = bbPlacementPresets[idx];
    if (!preset) return;
    const doDelete = function () {
        bbPlacementPresets.splice(idx, 1);
        bbSavePlacementPresets();
        bbRenderPlacementPresetList();
    };
    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm('配置を削除', `「${bbEsc(preset.name)}」を削除しますか？`, doDelete);
    } else {
        doDelete();
    }
}

function bbShowPlacementSaveNameOverlay() {
    const input = document.getElementById('bbPlacementSaveNameInput');
    if (input) input.value = '';
    const el = document.getElementById('bbPlacementSaveNameOverlay');
    if (el) el.style.display = 'flex';
}
function bbClosePlacementSaveNameOverlay() {
    const el = document.getElementById('bbPlacementSaveNameOverlay');
    if (el) el.style.display = 'none';
}
// ブラウザ標準のalert()ではなく、他のカード類と見た目を合わせた簡易な通知ポップを出す。
// 確認/キャンセルの分岐がない「お知らせ」だけのメッセージ向け（showCustomConfirmの代わり）。
function bbShowInfoPopup(text) {
    const textEl = document.getElementById('bbInfoPopupText');
    if (textEl) textEl.textContent = text;
    const overlay = document.getElementById('bbInfoPopupOverlay');
    if (overlay) overlay.style.display = 'flex';
}
function bbCloseInfoPopup() {
    const overlay = document.getElementById('bbInfoPopupOverlay');
    if (overlay) overlay.style.display = 'none';
}
function bbConfirmSavePlacement() {
    const input = document.getElementById('bbPlacementSaveNameInput');
    const typedName = (input && input.value || '').trim();
    const name = typedName || `配置${bbPlacementPresets.length + 1}`;
    // 保存元によって、slots（{regId, nodeId}の配列）の組み立て元が異なる。
    // ・'battle'：実際の配置フェーズのbbState.units（本編の盤面）から。
    // ・'prepEditor'：カレー準備画面の簡易配置エディタのbbPrepEditorPlacements（nodeId→regId）から。
    let slots = [];
    if (bbPlacementSaveSource === 'prepEditor') {
        slots = Object.keys(bbPrepEditorPlacements).map(nodeId => ({
            regId: bbPrepEditorPlacements[nodeId],
            nodeId: Number(nodeId)
        }));
    } else {
        const placed = bbState.units.filter(u => u.team === 'player');
        // bbState.playerPool[idx]とbbRegisteredRoster[idx]はインデックスが1対1で対応している
        // （bbState.playerPool = bbRegisteredRoster.map(bbGetEffectiveCurry)で作られるため）。
        // playerPool自体は配置フェーズに入るたびに作り直される一時オブジェクトなので、
        // 保存する識別子にはロースターエントリの安定ID（regId）を使う。
        placed.forEach(u => {
            const poolIdx = bbState.playerPool.indexOf(u.raw);
            const entry = (poolIdx !== -1) ? bbRegisteredRoster[poolIdx] : null;
            if (entry && entry.regId) {
                slots.push({ regId: entry.regId, nodeId: u.nodeId });
            }
        });
    }
    if (slots.length === 0) {
        alert('登録できる配置がありません。');
        return;
    }
    bbPlacementPresets.push({
        id: 'bbp' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        name: name,
        slots: slots,
        savedAt: Date.now()
    });
    bbSavePlacementPresets();
    bbClosePlacementSaveNameOverlay();
    bbShowInfoPopup(`「${name}」として配置を登録しました。`);
}

// 保存済みの配置を実際に盤面へ反映する（＝配置呼出の本体）。現在の自陣の配置はすべて
// 解除してから置き直す（上書き）。登録時から登録済みカレーが削除されている等でregIdが
// 見つからない枠は、そのマスを空きのままにしてポップアップで知らせる。
function bbApplyPlacementPreset(preset) {
    bbState.units = bbState.units.filter(u => u.team !== 'player');
    bbState.selectedPoolIndex = null;
    let missing = false;
    (preset.slots || []).forEach(slot => {
        const entry = bbRegisteredRoster.find(e => e.regId === slot.regId);
        const poolIdx = entry ? bbRegisteredRoster.indexOf(entry) : -1;
        const curry = (poolIdx !== -1) ? bbState.playerPool[poolIdx] : null;
        if (!entry || !curry) { missing = true; return; }
        if (bbState.units.some(u => u.nodeId === slot.nodeId)) return; // 念のための重複ガード
        const unit = bbMakeUnit(curry, 'player');
        unit.nodeId = slot.nodeId;
        bbState.units.push(unit);
    });
    bbRenderPlacementPanel();
    if (missing) {
        alert('該当カレーがないマスがあり、設置できませんでした。');
    }
}

// ------------------------------------------------------------
// 6.6 カレー準備画面の簡易配置エディタ（2×9マス＋旗）
//    実際の盤面（3D・マス画像・対戦相手）がまだ無いカレー準備画面でも、配置プリセット
//    （配置登録・配置呼出）を組み立てられるようにするための、簡易的な平面グリッド。
//    自陣の配置枠（旗の行を含む下2列）だけを再現し、マスの背景画像や3D表現は使わない。
//    ここで使うnodeId（row*BB_GRID_SIZE+col）は本編の盤面と同じ計算式なので、
//    ここで組んだ配置プリセットはそのまま本編の配置フェーズでも読み込める。
// ------------------------------------------------------------
let bbPrepEditorSelectedRegId = null; // 今タップして選択中のロースター内カレーのregId
let bbPrepEditorPlacements = {};       // { nodeId: regId } の形で、簡易エディタ上の配置状態を保持する

function bbOpenPrepPlacementEditor() {
    bbPrepEditorSelectedRegId = null;
    bbRenderPrepPlacementEditor();
    const el = document.getElementById('bbPrepPlacementEditorOverlay');
    if (el) el.style.display = 'flex';
}
function bbClosePrepPlacementEditor() {
    const el = document.getElementById('bbPrepPlacementEditorOverlay');
    if (el) el.style.display = 'none';
}
// { nodeId, regId, entry, eff }の配列（登録済みロースターから既に削除済みのregIdは除外する）。
function bbGetPrepEditorPlacedEntries() {
    return Object.keys(bbPrepEditorPlacements).map(nodeId => {
        const regId = bbPrepEditorPlacements[nodeId];
        const entry = bbRegisteredRoster.find(e => e.regId === regId);
        return entry ? { nodeId: Number(nodeId), regId, entry, eff: bbGetEffectiveCurry(entry) } : null;
    }).filter(Boolean);
}
function bbRenderPrepPlacementEditor() {
    const gridEl = document.getElementById('bbPrepEditorGrid');
    const rosterEl = document.getElementById('bbPrepEditorRosterList');
    const budgetEl = document.getElementById('bbPrepEditorBudgetLine');
    if (!gridEl || !rosterEl || !budgetEl) return;

    const placedEntries = bbGetPrepEditorPlacedEntries();
    const placedRegIds = new Set(placedEntries.map(p => p.regId));
    const total = placedEntries.reduce((sum, p) => sum + bbStatTotal(p.eff), 0);
    const remaining = BB_STAT_BUDGET - total;
    budgetEl.textContent = `合計ステータス: ${total} / ${BB_STAT_BUDGET}（残り${remaining}）　配置数: ${placedEntries.length} / ${BB_MAX_UNITS}`;
    budgetEl.classList.toggle('bb-over', total > BB_STAT_BUDGET);

    // グリッド：自陣の配置枠（下2行）だけを、奥の行→旗のある手前の行の順に並べる。
    let cellsHtml = '';
    BB_PLAYER_DEPLOY_ROWS.forEach(row => {
        for (let col = 0; col < BB_GRID_SIZE; col++) {
            const nodeId = row * BB_GRID_SIZE + col;
            const isFlag = (row === BB_ROW_BOTTOM && col === BB_FLAG_COL);
            if (isFlag) {
                cellsHtml += `<div class="bb-prepEditorCell bb-prepEditorCell-flag"><span class="bb-prepEditorCell-flagIcon">旗</span></div>`;
                continue;
            }
            const placed = placedEntries.find(p => p.nodeId === nodeId);
            if (placed) {
                cellsHtml += `<div class="bb-prepEditorCell bb-prepEditorCell-occupied" onclick="window.__bbOnPrepEditorCellClick(${nodeId})">
                    <img src="${bbGetCurryImg(placed.eff)}" alt="">
                    <div class="bb-prepEditorCell-name">${bbEsc(placed.eff.name)}</div>
                </div>`;
            } else {
                const selectableCls = bbPrepEditorSelectedRegId ? ' bb-prepEditorCell-selectable' : '';
                cellsHtml += `<div class="bb-prepEditorCell${selectableCls}" onclick="window.__bbOnPrepEditorCellClick(${nodeId})"></div>`;
            }
        }
    });
    gridEl.innerHTML = cellsHtml;

    // ロースター一覧：登録済みカレーをタップして配置先を選ぶ（本編の配置フェーズと同じ操作感）。
    rosterEl.innerHTML = bbRegisteredRoster.map((entry) => {
        const eff = bbGetEffectiveCurry(entry);
        const picked = placedRegIds.has(entry.regId);
        const selecting = (bbPrepEditorSelectedRegId === entry.regId);
        const cls = 'bb-rosterCard' + (picked ? ' bb-picked' : '') + (selecting ? ' bb-selecting' : '');
        return `<div class="${cls}" onclick="window.__bbOnPrepEditorPickRosterCurry('${entry.regId}')">
            <div class="bb-rcVisual"><img src="${bbGetCurryImg(eff)}" alt=""></div>
            <div class="bb-rcName">${bbEsc(eff.name)}</div>
            <div class="bb-rcStats">HP${eff.hp||0} ATK${eff.atk||0}<br>DEF${eff.def||0} SPD${eff.spd||0}</div>
            <div class="bb-rcTotal">合計 ${bbStatTotal(eff)}</div>
        </div>`;
    }).join('') || '<div style="font-size:11px;color:#b88742;">登録済みのカレーがありません。「カレー登録」からカレーを登録してください。</div>';
}
function bbOnPrepEditorPickRosterCurry(regId) {
    const placedEntries = bbGetPrepEditorPlacedEntries();
    const already = placedEntries.find(p => p.regId === regId);
    if (already) {
        // 既に配置済みのカードをもう一度タップ＝配置取り消し。
        delete bbPrepEditorPlacements[already.nodeId];
        bbPrepEditorSelectedRegId = null;
        bbRenderPrepPlacementEditor();
        return;
    }
    if (bbPrepEditorSelectedRegId === regId) {
        bbPrepEditorSelectedRegId = null; // もう一度タップ＝選択解除
        bbRenderPrepPlacementEditor();
        return;
    }
    if (placedEntries.length >= BB_MAX_UNITS) {
        alert(`配置できるのは最大${BB_MAX_UNITS}体までです。`);
        return;
    }
    bbPrepEditorSelectedRegId = regId;
    bbRenderPrepPlacementEditor();
}
function bbOnPrepEditorCellClick(nodeId) {
    const existingRegId = bbPrepEditorPlacements[nodeId];
    if (existingRegId) {
        // 配置済みのマスをタップ＝そのカレーを外す。
        delete bbPrepEditorPlacements[nodeId];
        bbPrepEditorSelectedRegId = null;
        bbRenderPrepPlacementEditor();
        return;
    }
    if (!bbPrepEditorSelectedRegId) return; // 選択中のカレーが無ければ何もしない
    const entry = bbRegisteredRoster.find(e => e.regId === bbPrepEditorSelectedRegId);
    if (!entry) { bbPrepEditorSelectedRegId = null; bbRenderPrepPlacementEditor(); return; }
    const placedEntries = bbGetPrepEditorPlacedEntries();
    const eff = bbGetEffectiveCurry(entry);
    const total = placedEntries.reduce((sum, p) => sum + bbStatTotal(p.eff), 0) + bbStatTotal(eff);
    if (total > BB_STAT_BUDGET) {
        alert(`ステータス合計が${BB_STAT_BUDGET}を超えるため配置できません。`);
        return;
    }
    bbPrepEditorPlacements[nodeId] = bbPrepEditorSelectedRegId;
    bbPrepEditorSelectedRegId = null;
    bbRenderPrepPlacementEditor();
}
function bbOnPrepEditorClearClick() {
    if (Object.keys(bbPrepEditorPlacements).length === 0) return;
    const doClear = function () {
        bbPrepEditorPlacements = {};
        bbPrepEditorSelectedRegId = null;
        bbRenderPrepPlacementEditor();
    };
    if (typeof showCustomConfirm === 'function') {
        showCustomConfirm('配置をクリア', '現在の配置をすべて外しますか？', doClear);
    } else {
        doClear();
    }
}
function bbOnPrepEditorSaveClick() {
    if (Object.keys(bbPrepEditorPlacements).length === 0) {
        alert('配置されているカレーがありません。');
        return;
    }
    bbPlacementSaveSource = 'prepEditor';
    if (bbPlacementPresets.length >= BB_PLACEMENT_PRESET_MAX) {
        bbShowPlacementPresetOverlay('deleteForSave');
        return;
    }
    bbShowPlacementSaveNameOverlay();
}
function bbOnPrepEditorLoadClick() {
    if (bbPlacementPresets.length === 0) {
        alert('登録済みの配置がありません。');
        return;
    }
    bbShowPlacementPresetOverlay('loadToPrepEditor');
}
// 保存済みの配置プリセットを、簡易エディタの状態へ反映する（実際の盤面には触れない）。
// 登録時から登録済みカレーが削除されている等でregIdが見つからない枠は、空きのままにする。
function bbApplyPresetToPrepEditor(preset) {
    bbPrepEditorPlacements = {};
    bbPrepEditorSelectedRegId = null;
    let missing = false;
    (preset.slots || []).forEach(slot => {
        const entry = bbRegisteredRoster.find(e => e.regId === slot.regId);
        if (!entry) { missing = true; return; }
        bbPrepEditorPlacements[slot.nodeId] = slot.regId;
    });
    bbRenderPrepPlacementEditor();
    if (missing) {
        alert('該当カレーがないマスがあり、設置できませんでした。');
    }
}

// 配置フェーズ中、行動順アイコンの帯（#bbTurnQueueBar、戦闘フェーズ専用）と同じ位置に、
// 敵の出撃予定のカレー（bbState.enemyPool＝bbOnStartBattleClickで実際に盤面へ配置される
// チーム）をアイコンで並べて見せる。
function bbRenderEnemyPreviewBar() {
    const bar = document.getElementById('bbEnemyPreviewBar');
    if (!bar) return;
    const pool = (bbState.enemyPool || []).slice(0, BB_MAX_UNITS);
    const icons = pool.map(c => `<div class="bb-turnIcon bb-team-enemy" title="${bbEsc(c.name || 'カレー')}"><img src="${bbGetCurryImg(c)}" alt=""></div>`).join('');
    bar.innerHTML = `<span class="bb-enemyPreviewLabel">敵の出撃予定：</span>${icons}`;
}

// ボードバトル開始演出：効果音（sound/horagai.mp3）を鳴らしつつ、画面中央にタイトルを
// 一時的に表示してからonDoneを呼ぶ（onDoneの中で実際の行動順開始＝bbScheduleNextTurnを行う）。
const BB_BATTLE_START_SPLASH_HOLD_MS = 1400; // 表示を保持する時間（フェードイン/アウトは別途）
const BB_BATTLE_START_SPLASH_FADE_MS = 300;
function bbShowBattleStartSplash(onDone) {
    const el = document.getElementById('bbBattleStartSplash');
    bbPlaySfx('sound/horagai.mp3');
    if (!el) { if (typeof onDone === 'function') onDone(); return; }
    el.style.display = 'flex';
    requestAnimationFrame(() => { el.classList.add('bb-show'); });
    setTimeout(() => {
        el.classList.remove('bb-show');
        setTimeout(() => {
            el.style.display = 'none';
            if (typeof onDone === 'function') onDone();
        }, BB_BATTLE_START_SPLASH_FADE_MS);
    }, BB_BATTLE_START_SPLASH_HOLD_MS);
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
    // 自軍にそんなバナナカレー（バナナトラップ持ち）が1体でもいれば、配置フェーズと
    // 戦闘開始の間にトラップ設置フェーズを挟む。いなければ従来通りそのまま戦闘開始。
    const hasBananaTrapUnit = bbState.units.some(u => u.team === 'player' && bbHasBananaTrap(u));
    if (hasBananaTrapUnit) {
        bbEnterTrapPhase();
    } else {
        bbStartBattlePhaseActual();
    }
}
function bbShuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }

// ------------------------------------------------------------
// 6.6 バナナトラップ設置フェーズ（配置フェーズと戦闘開始の間）
//    バナナトラップ持ちのカレーが編成にいる場合のみ発生する。盤面の好きなノーマルマス1つを
//    タップしてバナナマスに変更できる（設置は任意＝しなくても戦闘開始できる。もう一度
//    タップすれば移動でき、設置済みのバナナマスをタップすると撤去できる）。
// ------------------------------------------------------------
function bbEnterTrapPhase() {
    bbState.phase = 'trap';
    bbHideAllOverlaysAndPanels();
    document.getElementById('bbPlacementPanel').style.display = 'none';
    document.getElementById('bbBattlePanel').style.display = 'none';
    const trapPanelElEnter = document.getElementById('bbTrapPanel');
    if (trapPanelElEnter) trapPanelElEnter.style.display = 'block';
    bbNodes.forEach(n => { n.highlight = null; });
    bbUpdateHeaderCloseBtnLabel();
    bbRenderTrapPhasePanel();
}
// トラップ設置の対象にできるマス＝旗マスでなく、敵味方どちらの陣地（配置マス）でもなく、
// 駒もおらず、他の特殊地形（岩・水・毒）でもない通常マス（既に設置済みのバナナマス自身も、
// 撤去操作の対象としてタップ可能にする）。
function bbIsTrapPlaceableNode(n) {
    if (!n) return false;
    if (bbIsFlagNode(n)) return false;
    // 自陣・敵陣（配置マス）には設置できない。
    if (BB_ENEMY_DEPLOY_ROWS.includes(n.row) || BB_PLAYER_DEPLOY_ROWS.includes(n.row)) return false;
    if (bbState.units.some(u => u.nodeId === n.id)) return false;
    return n.terrain === null || n.terrain === BB_TERRAIN_BANANA;
}
function bbRenderTrapPhasePanel() {
    bbNodes.forEach(n => { n.highlight = bbIsTrapPlaceableNode(n) ? 'trapSelectable' : null; });
    const hasBanana = bbNodes.some(n => n.terrain === BB_TERRAIN_BANANA);
    const hintEl = document.getElementById('bbTrapHint');
    if (hintEl) {
        hintEl.textContent = hasBanana
            ? 'バナナマスを設置しました。タップすると移動・撤去できます。設置しなくても「バトル開始」で始められます。'
            : '好きなノーマルマスをタップすると、そこにバナナトラップ（バナナマス）を1つ設置できます。設置しなくても「バトル開始」で始められます。';
    }
    bbRenderBoard();
}
function bbOnTrapNodeClick(nodeId) {
    const node = bbNodesById[nodeId];
    if (!bbIsTrapPlaceableNode(node)) return;
    if (node.terrain === BB_TERRAIN_BANANA) {
        // 既に設置済みのバナナマスをタップ＝撤去。
        node.terrain = null;
    } else {
        // バナナマスは常に1つだけ＝新しく置く前に、既存のものがあれば取り除く（＝移動扱い）。
        bbNodes.forEach(n => { if (n.terrain === BB_TERRAIN_BANANA) n.terrain = null; });
        node.terrain = BB_TERRAIN_BANANA;
    }
    bbRenderTrapPhasePanel();
}
function bbOnTrapStartBattleClick() {
    if (bbState.phase !== 'trap') return;
    bbStartBattlePhaseActual();
}
// 実際に戦闘フェーズへ入る処理本体（トラップ設置フェーズを経由してもしなくても、最終的に
// ここへ合流する）。
function bbStartBattlePhaseActual() {
    bbState.phase = 'battle';
    bbRoundQueue = []; // 新しい戦闘の開始時は行動順キューをリセットする（前回の戦闘の残りを引き継がない）
    document.getElementById('bbPlacementPanel').style.display = 'none';
    const trapPanelElStart = document.getElementById('bbTrapPanel');
    if (trapPanelElStart) trapPanelElStart.style.display = 'none';
    document.getElementById('bbBattlePanel').style.display = 'block';
    // ここから行動順アイコンの帯を使うので表示に戻す（準備・配置フェーズでは隠していた）。
    // 配置フェーズ専用の敵出撃予定プレビュー帯は、代わりにここで隠す。
    const turnQueueBarElBattle = document.getElementById('bbTurnQueueBar');
    if (turnQueueBarElBattle) turnQueueBarElBattle.style.display = 'flex';
    const enemyPreviewBarElBattle = document.getElementById('bbEnemyPreviewBar');
    if (enemyPreviewBarElBattle) enemyPreviewBarElBattle.style.display = 'none';
    bbNodes.forEach(n => { n.highlight = null; });
    bbUpdateHeaderCloseBtnLabel(); // 戦闘フェーズ中は「×閉じる」→「×降参」に変わる
    bbRenderBoard();
    bbAppendLog('戦闘開始！');
    // 開始演出（horagai.mp3＋タイトル表示）が終わってから、戦闘BGMを再生しつつ行動順を開始する。
    bbShowBattleStartSplash(() => {
        bbPlayBattleBgm('sound/boardfield.mp3');
        bbScheduleNextTurn();
    });
}

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
    const winResult = bbCheckWinCondition();
    if (winResult) { bbEndBattle(winResult.winner, winResult.reason); return; }
    const actor = bbPickNextActor();
    if (!actor) return;
    bbState.activeUnit = actor;
    bbState.subPhase = (actor.team === 'player') ? 'move' : null;
    bbState.hasMovedThisTurn = false;
    bbState.pendingCommandMode = null;
    bbState.turnStartNodeId = actor.nodeId; // 「戻す」で移動前の位置に戻せるよう、手番開始時の位置を覚えておく
    bbRenderTurnQueuePreview();
    bbRenderBoard(); // ← アクティブな駒のノードを光らせるため再描画
    // ネバネバクダンで「1回休み」になっている駒は、移動・行動を一切行わせず、
    // 画面中央へスクロールしてきたところで❌が上へ消えていく演出だけを見せて手番を終える。
    if (actor.bbSkipNextTurn) {
        bbCenterOnNode(actor.nodeId, () => { bbResolveSkipTurn(actor); });
        return;
    }
    // 太陽のラタトゥイユカレー「太陽の恵み」：行動順が回ってきた時点で最大HPの20%を自動回復する
    // （満タンの時は回復のしようがないため、無意味な演出を出さないようスキップする）。
    if (bbHasSunBlessing(actor) && actor.hp > 0 && actor.hp < actor.maxHp) {
        bbCenterOnNode(actor.nodeId, () => { bbApplySunBlessing(actor, function () { bbProceedTurnAfterPassives(actor); }); });
        return;
    }
    bbProceedTurnAfterPassives(actor);
}
// 上記2つのパッシブ（1回休み・太陽の恵み）の処理が終わった後（あるいは元々どちらも
// 発動しない場合）に行う、これまで通りの移動・行動選択フェーズへの遷移。
function bbProceedTurnAfterPassives(actor) {
    if (actor.team === 'player') {
        bbCenterOnNode(actor.nodeId); // 行動順が回ってきた駒を画面中央へ自動的に移動
        bbHighlightMovableTiles(actor);
        // 移動しなければ、自分のコマをタップした時点でコマンドメニューが開く
        // （移動した場合はbbMoveUnitTo側で自動的に開くため、タップの手順は不要）。
        bbSetBattleStatus(`${actor.name} の番です。移動先のマスをタップするか、自分のコマをタップしてコマンドを選んでください。`);
    } else {
        bbSetBattleStatus(`${actor.name}（敵）が行動中…`);
        // 敵の駒はセンタリングのスクロールが完全に終わってから、さらに一呼吸置いて
        // 行動を開始する（スクロール中／直後にいきなり動き出すと忙しなく見えるため）。
        bbCenterOnNode(actor.nodeId, () => {
            setTimeout(() => { bbPerformEnemyTurn(actor); }, 450);
        });
    }
}
// ネバネバクダンで1回休みになっている駒の手番：❌が上へ移動しながらフェードアウトする
// 演出（毒・種発射などと同じbbShowDamagePopの仕組みを流用）を見せてから、フラグを消費して
// 次の手番へ進む（このターンは移動も行動も一切行わない）。
function bbResolveSkipTurn(actor) {
    bbAppendLog(`${actor.name} は1回休みだった。`);
    bbShowDamagePop(actor.nodeId, '❌', 'bb-skip-pop');
    setTimeout(function () {
        actor.bbSkipNextTurn = false;
        bbRenderBoard();
        bbRenderTurnQueuePreview();
        bbScheduleNextTurn();
    }, BB_DAMAGE_POP_MS);
}
// 太陽のラタトゥイユカレー「太陽の恵み」：最大HPの20%を回復し、回復POP（緑）とtaiyou.mp3を再生する。
const BB_SUN_BLESSING_HEAL_RATE = 0.2;
function bbApplySunBlessing(actor, onDone) {
    const heal = Math.max(1, Math.round(actor.maxHp * BB_SUN_BLESSING_HEAL_RATE));
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    bbAppendLog(`${actor.name} は太陽の恵みでHPが${heal}回復した！（残HP ${actor.hp}/${actor.maxHp}）`);
    bbPlaySfx('taiyou.mp3');
    bbShowDamagePop(actor.nodeId, `+${heal}`, 'bb-heal-pop');
    bbRenderBoard();
    setTimeout(function () { if (onDone) onDone(); }, BB_DAMAGE_POP_MS);
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
        // ネバネバクダンで1回休みになっている駒は、行動順バーのアイコンにも❌マークを重ねる。
        const cls = `bb-turnIcon bb-team-${u.team}${i === 0 ? ' bb-current' : ''}${u.bbSkipNextTurn ? ' bb-skip-pending' : ''}`;
        // 逆に行動順の駒をタップしても、その駒の詳細（bbShowUnitDetail）が開けるようにする。
        return `<div class="${cls}" data-bb-uid="${u.uid}" title="${bbEsc(u.name)}" onclick="window.__bbOnTapTurnIcon(${u.uid})"><img src="${bbGetCurryImg(u.raw)}" alt=""></div>`;
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
            // バナナマスは「必ず停止しなくてはならないマス」。到達・停止はできるが、
            // そこを踏み台にしてさらに先へ移動範囲を広げることはできない（強制的な行き止まり）。
            if (bbNodesById[nid].terrain !== BB_TERRAIN_BANANA) nextFrontier.push(nid);
        });
        frontier = nextFrontier;
    }
    bbLastMoveParent = parent;
    // 自陣の旗マスには移動先として「止まる」ことができない（配置フェーズで自陣旗に
    // 配置できないのと同じ理由）。敵の旗マスに乗ることは勝利条件そのものなので、
    // そちらは対象外のまま残す（bbCheckWinCondition参照）。
    const ownFlagId = bbGetFlagNodeId(unit.team);
    if (ownFlagId != null) result.delete(ownFlagId);
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

// 駒の詳細カード（bbShowUnitDetail）を開いている間、その駒の移動可能範囲を
// チームカラーの枠で見せておくためのプレビュー表示。手番中の本来の移動可能ハイライト
// （n.highlight='movable'、黄色）とは別のプロパティ（n.moveHighlight）で管理するため、
// 自分の手番の移動先選択の見た目には一切影響しない。
function bbShowMoveRangePreview(unit) {
    bbNodes.forEach(n => { n.moveHighlight = null; });
    bbGetMovableNodeIds(unit).forEach(nid => { bbNodesById[nid].moveHighlight = unit.team; });
    bbRenderBoard();
}
function bbClearMoveRangePreview() {
    let changed = false;
    bbNodes.forEach(n => { if (n.moveHighlight) { n.moveHighlight = null; changed = true; } });
    if (changed) bbRenderBoard();
}

function bbGetMovableNeighbors(unit) {
    return Array.from(bbGetMovableNodeIds(unit));
}

function bbOnBattleNodeClick(nodeId) {
    const actor = bbState.activeUnit;
    const node = bbNodesById[nodeId];
    if (actor && actor.team === 'player' && actor.hp > 0) {
        if (bbState.subPhase === 'move') {
            // 自分のコマをタップ＝移動前でも移動後でも、コマンドメニュー
            // （戦闘を挑む／特技／待機／詳細）を開く。
            if (nodeId === actor.nodeId) { bbOpenCommandMenu(actor); return; }
            // 移動できるマスをタップした場合（このターンでまだ移動していない時のみ有効。
            // 敵駒がいるマスはそもそも移動可能マスに含まれない）。
            if (!bbState.hasMovedThisTurn && node.highlight === 'movable') { bbMoveUnitTo(actor, nodeId); return; }
        } else if (bbState.subPhase === 'action') {
            // ターゲット選択中に行動中の駒自身をタップした場合は、コマンドメニューを
            // 再表示して行動をやり直せるようにする。
            if (nodeId === actor.nodeId) { bbOpenCommandMenu(actor); return; }
            // コマンドメニューで「戦闘を挑む」「特技」を選んだ後、対象（隣接する敵駒・岩、
            // 種発射の射程内の敵）をタップした場合。
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
// 敵（AI）が攻撃対象を決めてから、実際に戦闘・岩破壊を実行するまでの「予告」時間。
// この間、対象マスへ矢印アニメーションを表示し続けることで、いきなり戦闘画面へ
// 切り替わらないようにする。
const BB_AI_ATTACK_TELEGRAPH_MS = 2000;
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

    const g = document.createElementNS(ns, 'g');
    g.style.transform = 'translate(0px, 0px)';
    // 通常描画（bbRenderBoard）と同じコイン型の見た目（上面カレーイラスト＋側面チーム色）を
    // 浮動スプライトにもそのまま使う。文字列で組み立ててinnerHTMLに流し込めば、
    // clipPath/画像などをここで個別にDOM構築する必要がない（bbRenderBoard側と同じヘルパー）。
    g.innerHTML = bbCoinMarkup(fromNode.x, fromNode.y - BB_COIN_Y_LIFT, r2, unit.team, bbGetCurryImg(unit.raw), `anim${unit.uid}_${Date.now()}`);
    viewportG.appendChild(g);

    // 1マスあたりの区間時間（マス数が多いほど短くし、全体としてはBB_MOVE_ANIM_MS前後に収める）。
    const segMs = Math.max(90, Math.min(160, Math.round(BB_MOVE_ANIM_MS / steps.length)));
    let idx = 0;
    function runSegment() {
        if (idx >= steps.length) {
            if (viewportG.contains(g)) viewportG.removeChild(g);
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

// 敗北・力尽きて盤面から消える駒を、瞬時に消すのではなくフェードアウト（縮小＋透明化）
// させてから実際にbbState.unitsから取り除く。bbAnimateUnitMoveと同じ「浮動スプライトを
// 重ねて、通常描画側は_animatingで隠す」やり方を流用する。
const BB_FADE_OUT_MS = 550;
function bbFadeOutUnit(unit, onComplete) {
    const node = bbNodesById[unit.nodeId];
    const viewportG = document.getElementById('bbViewportG');
    if (!node || !viewportG) { onComplete(); return; }
    const ns = 'http://www.w3.org/2000/svg';
    const r2 = BB_NODE_R - 4;

    unit._animating = true; // 通常描画（bbRenderBoard）側では非表示にする
    bbRenderBoard();

    const g = document.createElementNS(ns, 'g');
    g.style.transform = 'scale(1)';
    g.style.opacity = '1';
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'center';
    g.innerHTML = bbCoinMarkup(node.x, node.y - BB_COIN_Y_LIFT, r2, unit.team, bbGetCurryImg(unit.raw), `fade${unit.uid}_${Date.now()}`);
    viewportG.appendChild(g);

    requestAnimationFrame(() => {
        void g.getBoundingClientRect(); // 初期状態を確実に反映させてからトランジションを開始する
        g.style.transition = `opacity ${BB_FADE_OUT_MS}ms ease-in, transform ${BB_FADE_OUT_MS}ms ease-in`;
        requestAnimationFrame(() => {
            g.style.opacity = '0';
            g.style.transform = 'scale(0.35)';
        });
    });
    setTimeout(() => {
        if (viewportG.contains(g)) viewportG.removeChild(g);
        onComplete();
    }, BB_FADE_OUT_MS);
}

// 指定したマスの位置に、ダメージ数値が浮かび上がって消えるPOPを表示する（毒マス通過時など）。
// 盤面のSVG（#bbBoardSvg）はCSSの3D変形（rotateX）で傾けているため、その内部に描くと
// 数字も一緒に傾いて見えてしまう。そこで#bbBoardSvgの外側の兄弟要素である平面レイヤー
// （#bbFxLayer）にHTML要素として重ね、対象マスの実際の画面上の位置（getBoundingClientRect、
// パン・ズーム・3D変形すべて反映済みの見た目上の位置）に配置することで、傾きの影響を
// 受けずに常に正面を向いたまま表示する。
const BB_DAMAGE_POP_MS = 750;
// extraClassを指定すると、通常の赤いダメージ数字とは別の見た目（回復＝緑、❌マーク等）にできる
// （太陽の恵みの回復POP・ネバネバクダンの1回休み演出で使用）。
function bbShowDamagePop(nodeId, text, extraClass) {
    const tileEl = document.getElementById('bbTile' + nodeId);
    const fxLayer = document.getElementById('bbFxLayer');
    const wrapEl = document.getElementById('bbBoardWrap');
    if (!tileEl || !fxLayer || !wrapEl) return;
    const tileRect = tileEl.getBoundingClientRect();
    const wrapRect = wrapEl.getBoundingClientRect();
    const div = document.createElement('div');
    div.className = 'bb-damage-pop-html' + (extraClass ? (' ' + extraClass) : '');
    div.textContent = text;
    div.style.left = (tileRect.left - wrapRect.left + tileRect.width / 2) + 'px';
    div.style.top = (tileRect.top - wrapRect.top) + 'px';
    fxLayer.appendChild(div);
    requestAnimationFrame(() => {
        void div.getBoundingClientRect(); // 初期状態を確実に反映させてからトランジションを開始する
        div.classList.add('bb-damage-pop-html-anim');
    });
    setTimeout(() => {
        if (fxLayer.contains(div)) fxLayer.removeChild(div);
    }, BB_DAMAGE_POP_MS);
}

// 毒マスのダメージ演出：まずpoison.mp3を鳴らし、その少し後にpunch.mp3と同時に
// ダメージ数値のPOPを駒の位置（node）に表示する。onDoneはPOPが完全に消えた後に呼ばれる
// （毒ダメージのPOPが表示されている最中に次の駒へ画面がスクロールしてしまわないようにするため）。
const BB_POISON_HIT_DELAY_MS = 450;
function bbPlayPoisonHitEffect(nodeId, dmg, onDone) {
    bbPlaySfx('poison.mp3');
    setTimeout(() => {
        bbPlaySfx('punch.mp3');
        bbShowDamagePop(nodeId, `-${dmg}`);
        setTimeout(() => { if (onDone) onDone(); }, BB_DAMAGE_POP_MS);
    }, BB_POISON_HIT_DELAY_MS);
}

// 種発射のヒット演出：毒と違い前置きの効果音は無く、命中と同時に効果音＋POPを出す。
// onDoneはPOPが完全に消えた後に呼ばれる（次の駒への画面スクロールを待たせるため）。
function bbPlaySeedHitEffect(nodeId, popText, sfxPath, onDone) {
    bbPlaySfx(sfxPath);
    bbShowDamagePop(nodeId, popText);
    setTimeout(() => { if (onDone) onDone(); }, BB_DAMAGE_POP_MS);
}

// 移動経路（bbReconstructMovePathで得た、出発地点を含まないnodeId配列）を順にたどり、
// 毒マスのダメージを適用する。ダメージ自体はここで即座に確定させるが、演出（効果音・POP）は
// 1つずつ順番に再生し、最後のPOPが消え終わってからonDone(diedOnTheWay)を呼ぶ
// （＝呼び出し側の次の処理・次の駒への画面スクロールは、演出がすべて終わるまで待たされる）。
// ※岩マスは移動中は誰も通行できないため（bbGetMovableNodeIdsで除外済み）、ここでは扱わない。
//   岩の破壊は移動後の「攻撃」アクション（bbExecuteAction）でのみ行う。
function bbApplyTerrainEffectsAlongPath(unit, path, onDone) {
    const hits = [];
    let diedOnTheWay = false;
    for (let i = 0; i < path.length; i++) {
        const node = bbNodesById[path[i]];
        if (!node) continue;
        if (node.terrain === BB_TERRAIN_POISON && !bbIsPoisonImmune(unit)) {
            const dmg = Math.max(1, Math.round(unit.maxHp * 0.2));
            unit.hp = Math.max(0, unit.hp - dmg);
            bbAppendLog(`${unit.name} は毒マスで${dmg}ダメージを受けた！（残HP ${unit.hp}/${unit.maxHp}）`);
            hits.push({ nodeId: node.id, dmg });
            if (unit.hp <= 0) {
                bbAppendLog(`${unit.name} は毒で力尽きた。`);
                diedOnTheWay = true;
                break;
            }
        }
    }
    // 移動アニメーション終了直後は、直前のbbRenderBoard()呼び出し（移動開始時、
    // その駒を通常描画から隠した状態）がまだ残っており、浮動スプライトも既に片付けられて
    // いるため、ここで一度描き直さないと駒が一瞬（毒の演出中ずっと）盤面から消えて見える。
    // 毒ダメージ自体はここまでで確定済みなので、力尽きていてもHPバーが0のコマとして
    // そのまま描画される（実際に取り除くのは、この後の演出がすべて終わってから）。
    bbRenderBoard();
    if (hits.length === 0) { onDone(diedOnTheWay); return; }
    let idx = 0;
    function playNext() {
        if (idx >= hits.length) { onDone(diedOnTheWay); return; }
        const hit = hits[idx];
        idx++;
        bbPlayPoisonHitEffect(hit.nodeId, hit.dmg, playNext);
    }
    playNext();
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
        // 毒ダメージの演出（効果音・ダメージPOP）がすべて終わるまで、次の処理（行動選択フェーズ
        // への移行や、次の駒への画面スクロール）は待つ。
        bbApplyTerrainEffectsAlongPath(unit, movePath, function (diedOnTheWay) {
            if (diedOnTheWay) {
                // 毒で力尽きた場合はフェードアウトさせてから盤面・次の手番へ（行動選択は行わない）。
                bbFadeOutUnit(unit, function () {
                    bbState.units = bbState.units.filter(u => u !== unit);
                    bbRenderBoard();
                    setTimeout(bbScheduleNextTurn, 300);
                });
                return;
            }
            // バナナマスに乗った場合：本編対戦でバナナですべった時と同じ効果音を鳴らし、
            // そのマスをノーマルマスへ戻す（誰かが1度乗ったらトラップとしての役目は終わる）。
            const landedNode = bbNodesById[unit.nodeId];
            if (landedNode && landedNode.terrain === BB_TERRAIN_BANANA) {
                landedNode.terrain = null;
                bbAppendLog(`${unit.name} はバナナトラップを踏んでしまった！`);
                bbPlaySfx('poincyo.mp3');
            }
            bbRenderBoard();
            // 相手の旗のマスへ移動した時点で、行動選択（攻撃・岩破壊・種発射など）を挟むことなく
            // 即座に勝敗を決定する（bbCheckWinConditionは自陣・敵陣どちらの旗に乗ったかも含めて判定する）。
            const winResult = bbCheckWinCondition();
            if (winResult) { bbEndBattle(winResult.winner, winResult.reason); return; }
            if (unit.team === 'player') {
                // プレイヤーの移動は1ターンに1回のみ。移動後はタップを待たず、
                // 自動的にコマンドメニュー（戦闘を挑む／特技／待機／詳細）を開く。
                bbState.hasMovedThisTurn = true;
                bbNodes.forEach(n => { n.highlight = null; });
                bbRenderBoard();
                bbOpenCommandMenu(unit);
            } else {
                bbEnterActionPhase(unit);
            }
        });
    });
}

// 盤面全体を対象に、targetNodeIdから「そのunitにとって通行可能な地形だけ」をたどるBFSで
// 各マスまでの歩数を求める（他の駒の位置は無視＝地形だけで見た理論上の到達可能性・距離）。
// 岩は誰も通れない、水は海の幸カレー以外通れない、というルールに従うため、
// 「わんぱく・海の幸なら通れるが、そうでなければ迂回や行き止まりになる」を正しく判定できる。
// 戻り値はMap<nodeId, 歩数>。地形的にそもそも辿り着けないマスはMapに含まれない（＝距離Infinity扱い）。
function bbComputeTerrainDistanceMap(unit, targetNodeId) {
    const dist = new Map();
    if (targetNodeId == null || !bbNodesById[targetNodeId]) return dist;
    dist.set(targetNodeId, 0);
    let frontier = [targetNodeId];
    let step = 0;
    while (frontier.length > 0) {
        step++;
        const next = [];
        frontier.forEach(nid => {
            bbNodesById[nid].neighbors.forEach(nnid => {
                if (dist.has(nnid)) return;
                const n = bbNodesById[nnid];
                if (n.terrain === BB_TERRAIN_ROCK) return; // 岩：誰も通れない
                if (n.terrain === BB_TERRAIN_WATER && !bbCanCrossWater(unit)) return; // 水：海の幸以外は通れない
                dist.set(nnid, step);
                next.push(nnid);
            });
        });
        frontier = next;
    }
    return dist;
}

// 移動可能なマスの中から、targetNodeに一番近づけるマスを選ぶ（複数候補が同着ならランダム）。
// ※敵がいるマスはbbGetMovableNodeIdsの時点で候補に含まれないため、ここで敵マスを優先する
//   処理は不要（移動先として渡ってくる時点で必ず空きマス）。
// ※直線距離ではなく、bbComputeTerrainDistanceMapで求めた「実際にそのunitが通れる地形だけを
//   たどった歩数」で比較する。これにより、見た目の直線距離では近くても岩・水（このunitには
//   通れない場合）で行き止まりになっている方向へ突き進んでしまうのを防ぎ、実際に旗へ
//   たどり着ける経路がある移動先を優先する。全ての移動可能マスが行き止まり（＝どのみち
//   目的地へ到達できない）の場合だけ、従来通り直線距離で決める。
function bbPickMoveTowardNode(unit, moves, targetNode) {
    const distMap = bbComputeTerrainDistanceMap(unit, targetNode.id);
    const reachable = moves.filter(nid => distMap.has(nid));
    const pool = reachable.length > 0 ? reachable : moves;
    const useTerrainDist = reachable.length > 0;
    let bestDist = Infinity;
    let bestMoves = [];
    pool.forEach(nid => {
        const d = useTerrainDist ? distMap.get(nid) : bbDist(bbNodesById[nid], targetNode);
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
// 種カレー専用：上下左右4方向それぞれへ、直線上3マス以内にいる最初の駒を狙う
// （「種」は途中の駒（味方でも）や岩に当たるとそこで止まるため、その手前は狙えない。
// 　盤面は行・列で管理された正方グリッドなので、直線＝row/colを1方向だけ加算していく）。
const BB_SEED_SHOT_RANGE = 3;
function bbGetSeedShotTargets(unit) {
    const start = bbNodesById[unit.nodeId];
    if (!start) return [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const targets = [];
    dirs.forEach(([dr, dc]) => {
        for (let step = 1; step <= BB_SEED_SHOT_RANGE; step++) {
            const n = bbFindNode(start.row + dr * step, start.col + dc * step);
            if (!n) break; // 盤面の外に出た
            if (n.terrain === BB_TERRAIN_ROCK) break; // 岩に当たって止まる
            const occupant = bbState.units.find(u => u.nodeId === n.id && u.hp > 0);
            if (occupant) {
                if (occupant.team !== unit.team) targets.push(occupant);
                break; // 誰か（味方でも）いたらそこで止まる＝その奥は狙えない
            }
        }
    });
    return targets;
}

// 隣接マス（上下左右）にいる攻撃対象をまとめて返す。
// enemies: 攻撃対象となる敵駒の配列（種カレーは隣接に限らず「種発射」の射程で判定する）。
// rocks: 隣接する岩マスのノード（わんぱくのみ攻撃可）の配列。
function bbGetAdjacentActionTargets(unit) {
    const targets = { enemies: [], rocks: [] };
    const node = bbNodesById[unit.nodeId];
    if (!node) return targets;
    const canBreakRock = bbCanBreakRock(unit);
    if (bbIsSeedShooter(unit)) {
        targets.enemies = bbGetSeedShotTargets(unit);
    } else {
        node.neighbors.forEach(nid => {
            const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
            if (occupant && occupant.team !== unit.team) targets.enemies.push(occupant);
        });
    }
    node.neighbors.forEach(nid => {
        const n = bbNodesById[nid];
        const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
        if (!occupant && n.terrain === BB_TERRAIN_ROCK && canBreakRock) {
            targets.rocks.push(n);
        }
    });
    return targets;
}

// 対象のマスへ向かって進む矢印を2秒表示してから実行に移る共通処理（通常攻撃・岩破壊・
// 各種特技のいずれでも使う。いきなり戦闘画面／技の演出へ切り替わらないように、
// 「これから何を狙うか」を見せる間を作る）。
function bbTelegraphAiAction(unit, targetNodeId, onExecute) {
    bbNodes.forEach(n => { n.highlight = null; });
    bbNodesById[targetNodeId].highlight = 'attackable';
    bbRenderBoard();
    setTimeout(() => {
        bbNodes.forEach(n => { n.highlight = null; });
        onExecute();
    }, BB_AI_ATTACK_TELEGRAPH_MS);
}

function bbEnterActionPhase(unit) {
    if (bbState.phase !== 'battle' || !bbState.units.includes(unit) || unit.hp <= 0) { bbScheduleNextTurn(); return; }
    if (unit.team === 'player') {
        // プレイヤーの行動選択は新方式（コマンドメニュー）で行うため、こちらは念のための
        // フォールバックとしてコマンドメニューを開くだけに留める（通常はbbOpenCommandMenuが直接呼ばれる）。
        bbOpenCommandMenu(unit);
        return;
    }
    // ヒリヒリクラッシュ：隣接する敵が2体以上いる場合、通常攻撃よりも優先して使う
    // （複数体を同時に巻き込める状況でのみ使う、というAIの簡易的な判断基準。
    // 　1体以下しかいない場合はこの下の通常の隣接攻撃にフォールバックする）。
    if (bbHasHiriHiri(unit)) {
        const hhNode = bbNodesById[unit.nodeId];
        const adjacentEnemyCount = hhNode ? hhNode.neighbors.filter(nid => {
            const occ = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
            return occ && occ.team !== unit.team;
        }).length : 0;
        if (adjacentEnemyCount >= 2) {
            bbTelegraphAiAction(unit, unit.nodeId, () => bbResolveHiriHiri(unit));
            return;
        }
    }
    // ネバネバクダン：隣接する敵が1体でもいれば（未使用の場合のみ）通常攻撃よりも優先して使う
    // （ダメージに加えて「1回休み」を付与できる分、通常攻撃より価値が高いとみなす）。
    if (bbHasNebaNebaKudan(unit)) {
        const nebaTargets = bbGetMeleeAdjacentTargets(unit);
        if (nebaTargets.length > 0) {
            const nebaTarget = nebaTargets[Math.floor(Math.random() * nebaTargets.length)];
            bbTelegraphAiAction(unit, nebaTarget.nodeId, () => bbResolveNebaNebaKudan(unit, nebaTarget));
            return;
        }
    }
    const targets = bbGetAdjacentActionTargets(unit);
    // 敵（AI）：攻撃できる相手がいれば最優先、いなければわんぱく系（岩砕き）なら隣接する岩を破壊する。
    let chosen = null;
    if (targets.enemies.length > 0) {
        chosen = targets.enemies[Math.floor(Math.random() * targets.enemies.length)];
    } else if (targets.rocks.length > 0) {
        chosen = targets.rocks[Math.floor(Math.random() * targets.rocks.length)];
    }
    if (!chosen) { setTimeout(bbScheduleNextTurn, 300); return; }
    // chosenは敵ユニット（nodeIdを持つ）か岩マスのノード（idを持つ）のいずれか。
    const chosenNodeId = ('nodeId' in chosen) ? chosen.nodeId : chosen.id;
    bbTelegraphAiAction(unit, chosenNodeId, () => bbExecuteAction(unit, chosen));
}

// ------------------------------------------------------------
// 8.55 駒タップ→コマンドメニュー（戦闘を挑む／特技／待機／詳細）
//    移動後・移動せずのどちらでも、自分のコマをタップした時点でここに来る。
//    「戦闘を挑む」は常に隣接マスへの近接戦闘（本編の対戦カットイン）で、種カレーであっても
//    強制的に近接戦闘になる。「特技」はそのカレー固有の能動技（種発射／岩砕き）で、
//    持っていない・対象がいない場合はボタンをグレーアウトして押せなくする。
//    「待機」は常に選べる（何もせず手番を終える）。「詳細」は行動として消費されない。
// ------------------------------------------------------------
// 自分に隣接する敵駒（「戦闘を挑む」の対象。種カレーであっても射程拡張はせず、隣接のみ）。
function bbGetMeleeAdjacentTargets(unit) {
    const node = bbNodesById[unit.nodeId];
    const enemies = [];
    if (!node) return enemies;
    node.neighbors.forEach(nid => {
        const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
        if (occupant && occupant.team !== unit.team) enemies.push(occupant);
    });
    return enemies;
}
// そのカレーが持つ能動技（種発射／岩砕き）と、今使える対象一覧を返す。
// BB_SKILLSのactive:trueなものだけが「特技」コマンドの対象（水泳・ホームラン・盾ガード・
// 毒耐性は常時発動のパッシブなので、コマンドとしては選べない）。
function bbGetSkillTargetsFor(unit) {
    if (bbIsSeedShooter(unit)) {
        return { key: 'seed', name: '種発射', targets: bbGetSeedShotTargets(unit) };
    }
    if (bbCanBreakRock(unit)) {
        const node = bbNodesById[unit.nodeId];
        const rocks = [];
        if (node) {
            node.neighbors.forEach(nid => {
                const n = bbNodesById[nid];
                const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
                if (!occupant && n.terrain === BB_TERRAIN_ROCK) rocks.push(n);
            });
        }
        return { key: 'wanpaku', name: '岩砕き', targets: rocks };
    }
    if (bbHasHiriHiri(unit)) {
        // ヒリヒリクラッシュは対象を選ぶ技ではない（常に自分＋上下左右の全駒が対象）ため、
        // 他の特技のような「対象をタップして確定」は行わない（自分のマスしか対象にならず、
        // 自分の駒をタップする操作はコマンドメニューの再表示に割り当てられているため、
        // 対象選択UIとは根本的に相性が悪い＝bbOnCommandSkill側で即時実行する）。
        // ここではコマンドボタンの有効/無効の判定にだけ使うため、上下左右に敵が1体もいない
        // 場合は対象なし（targets:[]）を返し、コマンドをグレーアウトさせる。
        const node = bbNodesById[unit.nodeId];
        const hasEnemyInRange = !!(node && node.neighbors.some(nid => {
            const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
            return occupant && occupant.team !== unit.team;
        }));
        return { key: 'hirihiri', name: 'ヒリヒリクラッシュ', targets: (hasEnemyInRange && node) ? [node] : [] };
    }
    if (bbHasNebaNebaKudan(unit)) {
        // ネバネバクダン：隣接する敵1体を対象に選ぶ通常の技（種発射・岩砕きと同じ対象選択UI）。
        // 使用済み（unit.bbUsedNebaNeba）の場合はbbHasNebaNebaKudan自体がfalseを返すため、
        // ここには到達しない＝この関数を呼ぶ前の時点でコマンドがグレーアウトされる。
        return { key: 'nebaneba', name: 'ネバネバクダン', targets: bbGetMeleeAdjacentTargets(unit) };
    }
    return { key: null, name: '特技', targets: [] };
}
// 盤の上に表示するカード（コマンドメニュー・詳細画面）は、ヘッダー部分に限らずカード全体を
// ドラッグして自由な位置に動かせるようにする（盤が見えないと困る場面があるため）。
// ボタン等クリック可能な要素の上から始めたドラッグは誤操作防止のため無視する。
function bbMakeCardDraggable(boxEl) {
    if (!boxEl || boxEl._bbDragBound) return;
    boxEl._bbDragBound = true;
    let dragging = false, startX = 0, startY = 0, baseX = 0, baseY = 0;
    boxEl.addEventListener('pointerdown', function (evt) {
        if (evt.target && evt.target.closest && evt.target.closest('button,input,a')) return;
        dragging = true;
        boxEl.classList.add('bb-dragging');
        startX = evt.clientX; startY = evt.clientY;
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(boxEl.style.transform || '');
        baseX = m ? parseFloat(m[1]) : 0;
        baseY = m ? parseFloat(m[2]) : 0;
        if (boxEl.setPointerCapture) { try { boxEl.setPointerCapture(evt.pointerId); } catch (e) {} }
    });
    boxEl.addEventListener('pointermove', function (evt) {
        if (!dragging) return;
        const dx = evt.clientX - startX, dy = evt.clientY - startY;
        boxEl.style.transform = `translate(${baseX + dx}px, ${baseY + dy}px)`;
    });
    boxEl.addEventListener('pointerup', function () { dragging = false; boxEl.classList.remove('bb-dragging'); });
    boxEl.addEventListener('pointercancel', function () { dragging = false; boxEl.classList.remove('bb-dragging'); });
}
// コマンドメニューが開くたびに、行動中の駒の位置から拡大されるように出現させ、
// 効果音（sound/menu.mp3）を鳴らす。
function bbPlayCommandMenuOpenEffect(unit) {
    bbPlaySfx('sound/menu.mp3');
    const box = document.getElementById('bbCommandMenuBox');
    if (!box) return;
    const tileEl = unit ? document.getElementById('bbTile' + unit.nodeId) : null;
    box.classList.remove('bb-cmdMenuPopIn');
    box.style.transform = ''; // ドラッグでずらしていた位置はリセットし、駒の位置から出す
    if (tileEl && box.getBoundingClientRect) {
        const tileRect = tileEl.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        const dx = (tileRect.left + tileRect.width / 2) - (boxRect.left + boxRect.width / 2);
        const dy = (tileRect.top + tileRect.height / 2) - (boxRect.top + boxRect.height / 2);
        if (box.style.setProperty) {
            box.style.setProperty('--bbCmdPopDx', dx + 'px');
            box.style.setProperty('--bbCmdPopDy', dy + 'px');
        }
    }
    if (box.getBoundingClientRect) void box.getBoundingClientRect(); // 初期状態を反映させてからアニメーション開始
    box.classList.add('bb-cmdMenuPopIn');
}
// 「詳細」をコマンドメニューから開いた場合だけ、閉じた時にコマンドメニューへ自動的に戻る。
let bbCommandMenuReopenAfterDetail = false;
function bbOpenCommandMenu(unit) {
    if (bbState.phase !== 'battle' || bbState.activeUnit !== unit || unit.team !== 'player' || unit.hp <= 0) return;
    bbState.subPhase = 'menu';
    bbNodes.forEach(n => { n.highlight = null; });
    bbRenderBoard();
    const meleeTargets = bbGetMeleeAdjacentTargets(unit);
    const skillInfo = bbGetSkillTargetsFor(unit);
    const img = document.getElementById('bbCommandMenuImg');
    const nameEl = document.getElementById('bbCommandMenuName');
    if (img) img.src = bbGetCurryImg(unit.raw);
    if (nameEl) nameEl.textContent = unit.name || 'カレー';
    const challengeBtn = document.getElementById('bbCmdBtnChallenge');
    if (challengeBtn) challengeBtn.disabled = (meleeTargets.length === 0);
    const skillBtn = document.getElementById('bbCmdBtnSkill');
    if (skillBtn) {
        skillBtn.textContent = skillInfo.name;
        skillBtn.disabled = (skillInfo.targets.length === 0);
    }
    // 「戻す」は、移動済みなら移動を取り消して元の位置へ、移動していなければコマンドメニューを
    // 閉じて移動選択からやり直せるように、常に押せるようにしておく（bbOnCommandUndo側で分岐）。
    const undoBtn = document.getElementById('bbCmdBtnUndo');
    if (undoBtn) undoBtn.disabled = false;
    const overlay = document.getElementById('bbCommandMenuOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        bbPlayCommandMenuOpenEffect(unit);
    }
}
function bbCloseCommandMenu() {
    const overlay = document.getElementById('bbCommandMenuOverlay');
    if (overlay) overlay.style.display = 'none';
}
// コマンドメニューを閉じて移動選択のやり直しへ戻す。移動済みなら、このターン開始時点の
// 位置（bbState.turnStartNodeId）へ駒を戻す（＝移動そのものを取り消す）。移動せずに
// 自分のコマをタップしてコマンドメニューを開いただけの場合は、位置は変えずコマンドメニューを
// 閉じるだけで移動選択に戻れる（どちらのケースでも「戻す」を押せるようにしてある）。
function bbOnCommandUndo() {
    const actor = bbState.activeUnit;
    if (!actor) return;
    bbCloseCommandMenu();
    if (bbState.hasMovedThisTurn && bbState.turnStartNodeId != null) {
        actor.nodeId = bbState.turnStartNodeId;
        bbState.hasMovedThisTurn = false;
        bbAppendLog(`${actor.name} は移動をやり直すことにした。`);
    }
    bbState.subPhase = 'move';
    bbState.pendingCommandMode = null;
    bbNodes.forEach(n => { n.highlight = null; });
    bbRenderBoard();
    bbCenterOnNode(actor.nodeId);
    bbHighlightMovableTiles(actor);
    bbSetBattleStatus(`${actor.name} の番です。移動先のマスをタップするか、自分のコマをタップしてコマンドを選んでください。`);
}
// 対象（隣接する敵駒・岩、種発射の射程内の敵など）は、たとえ1体しかいなくても必ず盤面を
// ハイライトし、プレイヤー自身にタップで選択・確定してもらう（誤操作防止のため自動実行はしない）。
function bbBeginTargetSelection(actor, targets, mode) {
    bbCloseCommandMenu();
    if (!targets || targets.length === 0) return;
    bbState.subPhase = 'action';
    bbState.pendingCommandMode = mode;
    bbNodes.forEach(n => { n.highlight = null; });
    targets.forEach(t => {
        const nodeId = ('nodeId' in t) ? t.nodeId : t.id;
        bbNodesById[nodeId].highlight = 'attackable';
    });
    bbRenderBoard();
    bbSetBattleStatus(`${actor.name} の番です。対象をタップしてください。`);
}
function bbOnCommandChallenge() {
    const actor = bbState.activeUnit;
    if (!actor) return;
    bbBeginTargetSelection(actor, bbGetMeleeAdjacentTargets(actor), 'melee');
}
function bbOnCommandSkill() {
    const actor = bbState.activeUnit;
    if (!actor) return;
    const info = bbGetSkillTargetsFor(actor);
    if (info.key === 'hirihiri') {
        // ヒリヒリクラッシュは対象が常に自分のマスのみなので、他の特技のような
        // 「対象をタップして確定」を挟まない（自分の駒をタップする操作は既に
        // コマンドメニューの再表示に割り当てられており、対象選択タップと衝突するため）。
        // コマンドボタン自体はbbOpenCommandMenu側でtargets.length===0の時に無効化済み。
        if (info.targets.length === 0) return;
        bbCloseCommandMenu();
        bbNodes.forEach(n => { n.highlight = null; });
        bbRenderBoard();
        bbResolveHiriHiri(actor);
        return;
    }
    bbBeginTargetSelection(actor, info.targets, 'skill');
}
function bbOnCommandWait() {
    const actor = bbState.activeUnit;
    bbCloseCommandMenu();
    if (!actor) return;
    bbNodes.forEach(n => { n.highlight = null; });
    bbAppendLog(`${actor.name} は待機した。`);
    bbRenderBoard();
    setTimeout(bbScheduleNextTurn, 300);
}
// 「詳細」は行動として消費されない。閉じたら同じコマンドメニューへ自動的に戻る
// （bbCloseUnitDetail側でbbCommandMenuReopenAfterDetailを見て再度開く）。
function bbOnCommandDetail() {
    const actor = bbState.activeUnit;
    if (!actor) return;
    bbCloseCommandMenu();
    bbCommandMenuReopenAfterDetail = true;
    bbShowUnitDetail(actor);
}
// プレイヤーが「戦闘を挑む」「特技」を選んだ後、対象（盤面タップ、または対象1体のみの
// 場合の自動選択）が決まった時点で実際に行動を実行する。mode='melee'なら常に近接戦闘、
// mode='skill'ならそのカレーの能動技（種発射でダメージのみ／岩砕きで岩を破壊）を行う。
function bbExecutePickedCommand(actor, nodeId, mode) {
    const node = bbNodesById[nodeId];
    const defender = bbState.units.find(u => u.nodeId === nodeId && u.hp > 0 && u.team !== actor.team);
    bbNodes.forEach(n => { n.highlight = null; });
    // ヒリヒリクラッシュ：対象は常に自分自身のマス（敵味方関係なく上下左右にまとめてダメージが飛ぶため、
    // 個別の対象を選ぶのではなく「自分のマスをタップして確定する」だけの自己対象コマンド）。
    if (mode === 'skill' && nodeId === actor.nodeId && bbHasHiriHiri(actor)) {
        bbResolveHiriHiri(actor);
        return;
    }
    // ネバネバクダン：種発射と同じ「対象を選んでその場で解決」する能動技だが、通常戦闘
    // （本編の対戦カットイン）には進まないため、defenderの一般分岐より先に専用処理へ渡す。
    if (mode === 'skill' && defender && bbHasNebaNebaKudan(actor)) {
        bbResolveNebaNebaKudan(actor, defender);
        return;
    }
    if (defender) {
        bbExecuteAction(actor, defender, mode === 'melee');
        return;
    }
    if (node && node.terrain === BB_TERRAIN_ROCK) {
        bbExecuteAction(actor, node);
    }
}
// プレイヤーが対象選択サブフェーズで、ハイライトされた対象（敵駒 or 岩マス）をタップした場合。
function bbOnPickActionTarget(actor, nodeId) {
    bbExecutePickedCommand(actor, nodeId, bbState.pendingCommandMode);
}
// 選ばれた1つの行動を実行する。targetが盤面ノード（岩）ならそれを破壊、ユニットなら戦闘を行う。
// forceMelee=trueの場合、種カレーであっても「種発射」ではなく通常の近接戦闘（本編カットイン）を
// 強制する（隣接時に「戦闘を挑む」を選んだ場合に使う）。
function bbExecuteAction(unit, target, forceMelee) {
    bbNodes.forEach(n => { n.highlight = null; });
    if (target && target.terrain === BB_TERRAIN_ROCK) {
        target.terrain = null;
        bbAppendLog(`${unit.name} が岩を攻撃して破壊した！`);
        bbPlaySfx('sound/gankowari.mp3');
        bbRenderBoard();
        setTimeout(bbScheduleNextTurn, 500);
        return;
    }
    // 種カレーは隣接していなくても「種発射」で攻撃できるため、本編の対戦カットイン
    // （bbResolveBattle）ではなく、その場で直接1回分のダメージを与える簡易処理にする。
    // ただしforceMeleeが指定された場合（隣接時に「戦闘を挑む」を選んだ場合）は通常戦闘を行う。
    if (!forceMelee && bbIsSeedShooter(unit)) {
        bbResolveSeedShot(unit, target);
        return;
    }
    bbResolveBattle(unit, target);
}

// ------------------------------------------------------------
// 8.6 種カレーの「種発射」（隣接に限らない、通常攻撃1回分のダメージのみの簡易攻撃）
//    本編の対戦カットイン（startExternalBoardBattle）は駒同士を隣り合わせて画面いっぱいに
//    向き合わせる演出のため、離れた位置から撃つ「種発射」とは相性が悪い。そのため、
//    毒マスのダメージ演出（bbShowDamagePop等）と同じ仕組みで、その場で直接ダメージを
//    適用するだけの軽量な処理として実装する。
//    ※本編の戦闘エンジン内部の実際のダメージ計算式はgame.js側の難読化されたコードの中にあり
//    外部から呼び出せる形では公開されていないため（playSoundEffect等とは違い専用の
//    グローバル関数が無い）、ここでは簡易的なATK-DEF式（DEFの半分を差し引く）で
//    「通常攻撃1回分」を近似する。
function bbCalcSeedShotDamage(attacker, defender) {
    const atk = (attacker && attacker.atk) || 0;
    const def = (defender && defender.def) || 0;
    return Math.max(1, Math.round(atk - def * 0.5));
}
function bbResolveSeedShot(attacker, defender) {
    bbAppendLog(`${attacker.name} の「種発射」！`);
    bbRenderBoard();
    if (bbHasSeedGuard(defender)) {
        bbAppendLog(`${defender.name} は盾で防いだ！ ダメージ0。`);
        bbPlaySeedHitEffect(defender.nodeId, 'Guard', 'sound/guard.mp3', function () {
            setTimeout(bbScheduleNextTurn, 200);
        });
        return;
    }
    if (bbIsHomerunCurry(defender)) {
        bbAppendLog(`${defender.name} が打ち返した！ ダメージ0。`);
        bbPlaySeedHitEffect(defender.nodeId, 'Guard', 'sound/homerun.mp3', function () {
            setTimeout(bbScheduleNextTurn, 200);
        });
        return;
    }
    // ふわとろオムカレー「ふわとろバリア」：自分・隣接する仲間が対象の場合、ダメージを50%にする。
    const fluffyMul = bbGetFluffyBarrierMultiplier(defender);
    const dmg = Math.max(1, Math.round(bbCalcSeedShotDamage(attacker, defender) * fluffyMul));
    defender.hp = Math.max(0, defender.hp - dmg);
    bbAppendLog(`${defender.name} に${dmg}ダメージ！（残HP ${defender.hp}/${defender.maxHp}）`);
    if (fluffyMul < 1) bbPlaySfx('taiyou.mp3');
    bbRenderBoard();
    bbPlaySeedHitEffect(defender.nodeId, `-${dmg}`, 'punch.mp3', function () {
        if (defender.hp <= 0) {
            bbAppendLog(`${defender.name} は力尽きた。`);
            bbFadeOutUnit(defender, function () {
                bbState.units = bbState.units.filter(u => u !== defender);
                bbRenderBoard();
                setTimeout(bbScheduleNextTurn, 300);
            });
            return;
        }
        setTimeout(bbScheduleNextTurn, 200);
    });
}

// ------------------------------------------------------------
// 8.65 激辛エスニック・グリーンカレーの「ヒリヒリクラッシュ」
//    コマンドで選択すると、自分と上下左右に隣接する駒全て（敵味方関係なし）に
//    固定50ダメージを与える。効果音（hirihiri.mp3）は最初に1回だけ鳴らし、
//    その後は毒マスの多段ヒット演出（bbApplyTerrainEffectsAlongPath）と同じ考え方で、
//    対象ごとに順番にダメージPOPを表示してから次へ進む。自分自身も対象に含まれるため、
//    自分のHPが50以下なら自分も力尽きうる。
// ------------------------------------------------------------
const BB_HIRIHIRI_DAMAGE = 50;
function bbResolveHiriHiri(actor) {
    bbAppendLog(`${actor.name} の「ヒリヒリクラッシュ」！`);
    const node = bbNodesById[actor.nodeId];
    const targets = [actor];
    if (node) {
        node.neighbors.forEach(nid => {
            const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
            if (occupant) targets.push(occupant);
        });
    }
    bbPlaySfx('hirihiri.mp3');
    bbRenderBoard();
    const dead = [];
    let idx = 0;
    function playNext() {
        if (idx >= targets.length) { finishUp(); return; }
        const t = targets[idx];
        idx++;
        if (t.hp <= 0) { playNext(); return; } // 念のための保険（対象同士の重複は本来起こらない）
        // ふわとろオムカレー「ふわとろバリア」：t自身、またはtに隣接する仲間が持っていればダメージ半減。
        const fluffyMul = bbGetFluffyBarrierMultiplier(t);
        const dmg = Math.max(1, Math.round(BB_HIRIHIRI_DAMAGE * fluffyMul));
        t.hp = Math.max(0, t.hp - dmg);
        bbAppendLog(`${t.name} に${dmg}ダメージ！（残HP ${t.hp}/${t.maxHp}）`);
        bbShowDamagePop(t.nodeId, `-${dmg}`);
        if (fluffyMul < 1) bbPlaySfx('taiyou.mp3');
        bbRenderBoard();
        if (t.hp <= 0) {
            bbAppendLog(`${t.name} は力尽きた。`);
            dead.push(t);
        }
        setTimeout(playNext, BB_DAMAGE_POP_MS);
    }
    function finishUp() {
        if (dead.length === 0) { afterAllResolved(); return; }
        let dIdx = 0;
        function fadeNext() {
            if (dIdx >= dead.length) { afterAllResolved(); return; }
            const u = dead[dIdx];
            dIdx++;
            bbFadeOutUnit(u, fadeNext);
        }
        fadeNext();
    }
    function afterAllResolved() {
        bbState.units = bbState.units.filter(u => !dead.includes(u));
        bbRenderBoard();
        setTimeout(bbScheduleNextTurn, 300);
    }
    setTimeout(playNext, 150);
}

// ------------------------------------------------------------
// 8.66 ネバネバカレーの「ネバネバクダン」
//    隣接する敵1体に通常攻撃1回分のダメージ（種発射と同じ簡易ATK-DEF式）を与え、
//    さらに「1回休み」（unit.bbSkipNextTurn）を付与する。1体につき戦闘中1回のみ使用可能
//    （使用後はunit.bbUsedNebaNebaがtrueになり、bbHasNebaNebaKudanがfalseを返すため、
//    以後コマンドメニューの「特技」ボタンが自動的にグレーアウトする）。
// ------------------------------------------------------------
function bbResolveNebaNebaKudan(actor, defender) {
    actor.bbUsedNebaNeba = true;
    bbAppendLog(`${actor.name} の「ネバネバクダン」！`);
    bbRenderBoard();
    bbPlaySfx('sound/nebaneba.mp3');
    // ふわとろオムカレー「ふわとろバリア」：defender自身、またはdefenderに隣接する仲間が
    // 持っていればダメージを半減する。
    const fluffyMul = bbGetFluffyBarrierMultiplier(defender);
    const dmg = Math.max(1, Math.round(bbCalcSeedShotDamage(actor, defender) * fluffyMul));
    defender.hp = Math.max(0, defender.hp - dmg);
    bbAppendLog(`${defender.name} に${dmg}ダメージ！（残HP ${defender.hp}/${defender.maxHp}）`);
    if (fluffyMul < 1) bbPlaySfx('taiyou.mp3');
    bbRenderBoard();
    bbShowDamagePop(defender.nodeId, `-${dmg}`);
    setTimeout(function () {
        if (defender.hp <= 0) {
            bbAppendLog(`${defender.name} は力尽きた。`);
            bbFadeOutUnit(defender, function () {
                bbState.units = bbState.units.filter(u => u !== defender);
                bbRenderBoard();
                setTimeout(bbScheduleNextTurn, 300);
            });
            return;
        }
        // 倒れなかった場合のみ「1回休み」を付与する（力尽きた駒に付与しても意味がないため）。
        defender.bbSkipNextTurn = true;
        bbAppendLog(`${defender.name} は1回休み状態になった！`);
        bbRenderBoard();
        bbRenderTurnQueuePreview();
        setTimeout(bbScheduleNextTurn, 300);
    }, BB_DAMAGE_POP_MS);
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
    // hpはraw（本来の最大HP）のまま渡し、盤上ですでに減っている現在HPはstartHpとして別に渡す。
    // 本編のstartBattleScene側がstartHpに対応済みなら、最大HPは正しいまま現在HPだけ減った状態で
    // 決闘が始まり、決闘中の回復も本来の最大HPを基準に計算される（本編game.jsが未対応の古い
    // ビルドの場合はstartHpが単に無視され、従来通りraw.hpがそのままフルHPとして使われるだけなので、
    // 後方互換的に安全）。
    const myCurrySnapshot = Object.assign({}, playerUnit.raw, { startHp: playerUnit.hp });
    const oppCurrySnapshot = Object.assign({}, enemyUnit.raw, { startHp: enemyUnit.hp, name: enemyUnit.name });

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
        // 本編の決闘カットイン（done()）は自分の戦闘BGMを止めるだけで、盤面に戻ってきても
        // ボードバトル用BGMを再生し直してはくれない。盤面へ戻った時点でここから再開する
        // （この後すぐ全滅・旗到達などで対戦全体が終わる場合は、bbEndBattle側で改めて止まる）。
        bbPlayBattleBgm('sound/boardfield.mp3');
        playerUnit.hp = remainingPlayerHp;
        enemyUnit.hp = remainingOppHp;
        const moverIsPlayer = (mover.team === 'player');
        const moverWon = moverIsPlayer ? didPlayerWin : !didPlayerWin;
        const winner = moverWon ? mover : defender;
        const loser = moverWon ? defender : mover;
        bbAppendLog(`${loser.name} は力尽きた。${winner.name} の勝ち（残HP ${winner.hp}/${winner.maxHp}）`);
        // 敗北した駒は瞬時に消さず、フェードアウトしてから実際に盤面から取り除く。
        bbFadeOutUnit(loser, function () {
            bbState.units = bbState.units.filter(u => u !== loser);
            bbRenderBoard();
            setTimeout(bbScheduleNextTurn, 300);
        });
    });
}

// 勝敗が決まった場合、誰が勝ったか（winner）に加えて、旗を奪って勝ったのか（'flag'）
// 敵を全滅させて勝ったのか（'elimination'）も一緒に返す（bbEndBattle側の勝因/敗因表示に使う）。
function bbCheckWinCondition() {
    const playerUnits = bbState.units.filter(u => u.team === 'player' && u.hp > 0);
    const enemyUnits = bbState.units.filter(u => u.team === 'enemy' && u.hp > 0);
    if (enemyUnits.length === 0) return { winner: 'player', reason: 'elimination' };
    if (playerUnits.length === 0) return { winner: 'enemy', reason: 'elimination' };
    const playerOnEnemyFlag = playerUnits.some(u => u.nodeId === bbGetFlagNodeId('enemy'));
    if (playerOnEnemyFlag) return { winner: 'player', reason: 'flag' };
    const enemyOnPlayerFlag = enemyUnits.some(u => u.nodeId === bbGetFlagNodeId('player'));
    if (enemyOnPlayerFlag) return { winner: 'enemy', reason: 'flag' };
    return null;
}

// ------------------------------------------------------------
// 9.5 勝利報酬（ノーマル食材ランダム3つ。EXPはランクシステム導入に伴い廃止）
//    本編の通常戦闘・咖喱図書館ボス戦等と違い、ボードカレーバトルはdone()側のisBoardBattle
//    早期リターンでG・EXP・食材・実績・クエスト進行に一切触れない設計になっている
//    （盤面の駒がストックの経済に影響しないようにするための意図的な仕様）。
//    ここではその設計は変えず、盤面の対戦全体（1対1の決闘ではなく）に勝った時だけ、
//    ボードバトル専用の小さな固定報酬を、本編（game.js）のグローバル
//    （inventory/discoveredItems/saveGame等）へ直接、typeofガード付きで加算する。
const BB_WIN_REWARD_MATERIAL_COUNT = 3;
function bbGrantWinReward() {
    const rewardLines = [];
    const gainedNames = [];
    if (typeof inventory !== 'undefined' && typeof masterIngredients !== 'undefined') {
        const pool = (typeof getNormalIngredientPool === 'function')
            ? getNormalIngredientPool()
            : Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0);
        for (let i = 0; i < BB_WIN_REWARD_MATERIAL_COUNT; i++) {
            if (pool.length === 0) break;
            const itm = pool[Math.floor(Math.random() * pool.length)];
            inventory[itm] = (inventory[itm] || 0) + 1;
            if (typeof discoveredItems !== 'undefined') discoveredItems[itm] = true;
            gainedNames.push(itm);
        }
    }
    if (gainedNames.length > 0) {
        // 絵文字は使わず、入手した食材それぞれの実アイコン画像（masterIngredients[x].icon）を表示する。
        const iconsHtml = gainedNames.map(itm => {
            const d = masterIngredients[itm];
            const icon = d && d.icon
                ? `<img src="${bbEsc(d.icon)}" alt="" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`
                : '';
            return `${icon}${bbEsc(itm)}`;
        }).join('、');
        rewardLines.push(`勝利報酬：${iconsHtml}`);
    }
    if (typeof saveGame === 'function') { try { saveGame(); } catch (e) { /* 保存に失敗しても対戦の進行は止めない */ } }
    if (typeof updateFridgeUI === 'function') { try { updateFridgeUI(); } catch (e) {} }
    return rewardLines.join('<br>');
}

// ------------------------------------------------------------
// 9.6 ランクシステム（BETA）
//    F→E→D→C→B→A→S→SSの8段階。対戦（盤面全体の勝敗）1回ごとに★が1つ増減する。
//    ★4つで1つ上のランクへ（★は0にリセット）、★0で1つ下のランクへ（★は3にリセット＝
//    降格直後にもう一度勝てばすぐ元のランクに戻れるよう、下のランクの「満タン」から始まる）。
//    F(最低)・SS(最高)はそれ以上下がらない／上がらない（★は0または3で頭打ち）。
//    本編のsaveGame()には含めず、このファイル専用のlocalStorageキーで完結させる
//    （bbRegisteredRoster等と同じ設計方針）。
// ------------------------------------------------------------
const BB_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
const BB_RANK_STORAGE_KEY = 'qr_board_battle_rank';
let bbRankState = { rank: 'F', stars: 0, highestRank: 'F', claimed: [] };
function bbLoadRankState() {
    try {
        const raw = localStorage.getItem(BB_RANK_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
            const rank = BB_RANKS.includes(parsed.rank) ? parsed.rank : 'F';
            bbRankState = {
                rank: rank,
                stars: (typeof parsed.stars === 'number' && parsed.stars >= 0 && parsed.stars <= 3) ? parsed.stars : 0,
                highestRank: BB_RANKS.includes(parsed.highestRank) ? parsed.highestRank : rank,
                claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter(r => BB_RANKS.includes(r)) : []
            };
            return;
        }
    } catch (e) {
        console.warn('[ボードバトル] ランク情報の読み込みに失敗:', e);
    }
    bbRankState = { rank: 'F', stars: 0, highestRank: 'F', claimed: [] };
}
function bbSaveRankState() {
    try { localStorage.setItem(BB_RANK_STORAGE_KEY, JSON.stringify(bbRankState)); }
    catch (e) { console.warn('[ボードバトル] ランク情報の保存に失敗:', e); }
}
// 対戦結果（didWin）に応じてbbRankStateを更新し、変化内容を返す。
function bbApplyRankResult(didWin) {
    const oldRank = bbRankState.rank, oldStars = bbRankState.stars;
    let rankChanged = null;
    const idx = BB_RANKS.indexOf(bbRankState.rank);
    if (didWin) {
        bbRankState.stars += 1;
        if (bbRankState.stars >= 4) {
            if (idx < BB_RANKS.length - 1) {
                bbRankState.rank = BB_RANKS[idx + 1];
                bbRankState.stars = 0;
                rankChanged = 'up';
                if (BB_RANKS.indexOf(bbRankState.rank) > BB_RANKS.indexOf(bbRankState.highestRank)) {
                    bbRankState.highestRank = bbRankState.rank;
                }
            } else {
                bbRankState.stars = 3; // 最高ランク(SS)で頭打ち
            }
        }
    } else {
        bbRankState.stars -= 1;
        if (bbRankState.stars <= 0) {
            if (idx > 0) {
                bbRankState.rank = BB_RANKS[idx - 1];
                bbRankState.stars = 3;
                rankChanged = 'down';
            } else {
                bbRankState.stars = 0; // 最低ランク(F)で床
            }
        }
    }
    bbSaveRankState();
    return { rankChanged: rankChanged, oldRank: oldRank, oldStars: oldStars, newRank: bbRankState.rank, newStars: bbRankState.stars };
}
function bbFormatRank(rank, stars) { return (rank || 'F') + '★'.repeat(Math.max(0, stars || 0)); }
function bbIsRankAchieved(rank) { return BB_RANKS.indexOf(bbRankState.highestRank) >= BB_RANKS.indexOf(rank); }
// カレー準備画面・結果画面のランク表示テキストを共通で更新する。
function bbRenderRankLine(elId) {
    const el = document.getElementById(elId);
    if (el) el.textContent = `ランク: ${bbFormatRank(bbRankState.rank, bbRankState.stars)}`;
}

// ---- 管理者専用：カレー準備画面でランク・★を直接設定できるデバッグ機能 ----
//    本編のFEST_ADMIN_EXCLUDED_IDS（開発・検証用の管理者3キャラのプレイヤーID一覧）を
//    そのまま流用する。ボードカレーバトル自体の入口（bbInjectDom内の起動ボタン）は
//    isDebugModeが有効な間だけ表示されるが、それだけだと動作確認中のテスターにも
//    ランク編集ができてしまうため、より狭い「管理者3キャラ本人かどうか」で絞り込む。
function bbIsAdminUser() {
    return typeof FEST_ADMIN_EXCLUDED_IDS !== 'undefined' && Array.isArray(FEST_ADMIN_EXCLUDED_IDS)
        && typeof playerId !== 'undefined' && FEST_ADMIN_EXCLUDED_IDS.includes(playerId);
}
function bbRenderAdminRankEditor() {
    const wrap = document.getElementById('bbAdminRankEditor');
    if (!wrap) return;
    if (!bbIsAdminUser()) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    const rankSel = document.getElementById('bbAdminRankSelect');
    const starsSel = document.getElementById('bbAdminStarsSelect');
    if (rankSel) {
        rankSel.innerHTML = BB_RANKS.map(r => `<option value="${r}"${r === bbRankState.rank ? ' selected' : ''}>${bbEsc(r)}</option>`).join('');
        rankSel.value = bbRankState.rank;
    }
    if (starsSel) {
        starsSel.innerHTML = [0, 1, 2, 3].map(s => `<option value="${s}"${s === bbRankState.stars ? ' selected' : ''}>★${s}</option>`).join('');
        starsSel.value = String(bbRankState.stars);
    }
}
function bbOnAdminSetRank() {
    if (!bbIsAdminUser()) return;
    const rankSel = document.getElementById('bbAdminRankSelect');
    const starsSel = document.getElementById('bbAdminStarsSelect');
    const rank = rankSel ? rankSel.value : bbRankState.rank;
    const starsNum = starsSel ? parseInt(starsSel.value, 10) : bbRankState.stars;
    if (!BB_RANKS.includes(rank)) return;
    bbRankState.rank = rank;
    bbRankState.stars = (starsNum >= 0 && starsNum <= 3) ? starsNum : 0;
    if (BB_RANKS.indexOf(rank) > BB_RANKS.indexOf(bbRankState.highestRank)) {
        bbRankState.highestRank = rank;
    }
    bbSaveRankState();
    bbRenderRankLine('bbPrepRankLine');
    bbRenderAdminRankEditor();
    bbShowInfoPopup(`（管理者）ランクを${bbEsc(bbFormatRank(bbRankState.rank, bbRankState.stars))}に設定しました。`);
}

// ---- ランクアップ報酬（typeofガード付きで本編のグローバルへ直接加算する。bbGrantWinRewardと同じ方針） ----
function bbGrantGold(amount) {
    if (typeof playerG === 'undefined') return;
    playerG += amount;
    const goldEl = document.getElementById('globalG');
    if (goldEl) goldEl.innerText = playerG;
}
function bbGrantSpicyCoin(amount) {
    if (typeof spicyCoin === 'undefined') return;
    spicyCoin = (spicyCoin || 0) + amount;
}
function bbGrantFoodSample(amount) {
    if (typeof foodSampleCount === 'undefined') return;
    foodSampleCount = (foodSampleCount || 0) + amount;
}
function bbGrantPlayerIcon() {
    if (typeof unlockIcon !== 'function') return;
    try { unlockIcon('myimageicon/mayimage13.png'); } catch (e) {}
}
const BB_RANK_REWARDS = {
    SS: { desc: 'スパイシーコイン3個', grant: () => bbGrantSpicyCoin(3) },
    S: { desc: '食品サンプル5個', grant: () => bbGrantFoodSample(5) },
    A: { desc: 'スパイシーコイン1個', grant: () => bbGrantSpicyCoin(1) },
    B: { desc: '2000G', grant: () => bbGrantGold(2000) },
    C: { desc: '食品サンプル5個', grant: () => bbGrantFoodSample(5) },
    D: { desc: 'スパイシーコイン1個', grant: () => bbGrantSpicyCoin(1) },
    E: { desc: 'プレイヤーアイコン', grant: () => bbGrantPlayerIcon() },
    F: { desc: '500G', grant: () => bbGrantGold(500) }
};
function bbShowRankRewards() {
    bbRenderRankRewardsList();
    const el = document.getElementById('bbRankRewardsOverlay');
    if (el) el.style.display = 'flex';
}
function bbCloseRankRewards() {
    const el = document.getElementById('bbRankRewardsOverlay');
    if (el) el.style.display = 'none';
}
function bbRenderRankRewardsList() {
    const list = document.getElementById('bbRankRewardsList');
    if (!list) return;
    // SS→Fの順（ユーザーが指定した並び）で表示する。
    list.innerHTML = BB_RANKS.slice().reverse().map(rank => {
        const reward = BB_RANK_REWARDS[rank];
        const achieved = bbIsRankAchieved(rank);
        const claimed = bbRankState.claimed.includes(rank);
        let btnLabel = '未達成', btnDisabled = true;
        if (achieved && claimed) { btnLabel = '受取済み'; btnDisabled = true; }
        else if (achieved && !claimed) { btnLabel = '受け取る'; btnDisabled = false; }
        return `<div class="bb-rankRewardRow${achieved ? '' : ' bb-rankRewardLocked'}">
            <div class="bb-rankRewardName">${bbEsc(rank)}</div>
            <div class="bb-rankRewardDesc">${bbEsc(reward.desc)}</div>
            <button class="bb-actionBtn bb-small" ${btnDisabled ? 'disabled' : ''} onclick="window.__bbOnClaimRankReward('${rank}')">${btnLabel}</button>
        </div>`;
    }).join('');
}
function bbOnClaimRankReward(rank) {
    const reward = BB_RANK_REWARDS[rank];
    if (!reward) return;
    if (!bbIsRankAchieved(rank) || bbRankState.claimed.includes(rank)) return;
    try { reward.grant(); } catch (e) { console.warn('[ボードバトル] ランク報酬の付与に失敗:', e); }
    bbRankState.claimed.push(rank);
    bbSaveRankState();
    if (typeof saveGame === 'function') { try { saveGame(); } catch (e) {} }
    if (typeof updateFridgeUI === 'function') { try { updateFridgeUI(); } catch (e) {} }
    bbRenderRankRewardsList();
    bbShowInfoPopup(`「${bbEsc(rank)}ランク報酬」として${bbEsc(reward.desc)}を受け取りました！`);
}

// reasonは'flag'（旗を奪った／奪われた）か'elimination'（全滅させた／させられた）。
// bbCheckWinConditionから受け取った理由をそのまま勝敗テキストに反映し、どちらの方法で
// 決着したのかを明確にする。
function bbEndBattle(winner, reason) {
    bbState.phase = 'result';
    bbState.activeUnit = null;
    bbStopBattleBgm();
    bbUpdateHeaderCloseBtnLabel();
    document.getElementById('bbResultOverlay').style.display = 'flex';
    document.getElementById('bbResultTitle').textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
    let descHtml;
    if (winner === 'player') {
        descHtml = (reason === 'flag') ? '敵の旗を奪い、勝利！' : '敵の駒を全滅させ、勝利！';
    } else {
        descHtml = (reason === 'flag') ? '自陣の旗を奪われ、敗北…' : '自陣の駒を全滅させられ、敗北…';
    }
    if (winner === 'player') {
        const rewardHtml = bbGrantWinReward();
        if (rewardHtml) descHtml += '<br><br>' + rewardHtml;
    }
    document.getElementById('bbResultDesc').innerHTML = descHtml;
    // ランク（BETA）：勝敗にかかわらず★が増減し、条件を満たせばランクアップ／ダウンする。
    const rankResult = bbApplyRankResult(winner === 'player');
    const rankLineEl = document.getElementById('bbResultRankLine');
    if (rankLineEl) {
        let rankText = `ランク：${bbFormatRank(rankResult.newRank, rankResult.newStars)}`;
        if (rankResult.rankChanged === 'up') {
            rankText += '　ランクアップ！';
            bbPlaySfx('omedeto.mp3');
        } else if (rankResult.rankChanged === 'down') {
            rankText += '　ランクダウン…';
            bbPlaySfx('chin.mp3');
        }
        rankLineEl.textContent = rankText;
    }
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
    bbStopBattleBgm();
    document.getElementById('bbRoot').style.display = 'none';
}
function bbRestart() {
    bbStopBattleBgm();
    document.getElementById('bbResultOverlay').style.display = 'none';
    bbInit();
}
// 勝敗がついた結果画面の「戻る」：ボードバトルごと閉じてしまう（bbClose）のではなく、
// ボードバトル内のカレー準備画面（bbInit＝bbState.phase='prep'）へ戻す。
// 戦闘中の「×降参」からもこれをそのまま使う。
function bbBackToPrep() {
    bbStopBattleBgm();
    document.getElementById('bbResultOverlay').style.display = 'none';
    bbInit();
}

// ヘッダー右上の「×閉じる」ボタン：戦闘フェーズ中だけ「×降参」表示になり、確認の上で
// ボードバトルごと閉じる（bbClose）のではなく、カレー準備画面（bbBackToPrep）へ戻す。
// それ以外のフェーズ（準備・配置・結果）では従来通りボードバトル自体を閉じる。
function bbUpdateHeaderCloseBtnLabel() {
    const btn = document.getElementById('bbCloseBtn');
    if (!btn) return;
    btn.textContent = (bbState.phase === 'battle') ? '✕ 降参' : '✕ 閉じる';
}
function bbOnHeaderCloseClick() {
    if (bbState.phase === 'battle') {
        const doSurrender = function () { bbBackToPrep(); };
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('降参しますか？', '対戦を中断して、カレー準備画面に戻ります。', doSurrender);
        } else {
            doSurrender();
        }
        return;
    }
    bbClose();
}

// ------------------------------------------------------------
// 11.5 盤面の駒をタップした時の詳細表示
// ------------------------------------------------------------
// opts.onConfirm を渡すと、詳細カードに「攻撃する」等の実行ボタンが追加表示される
// （敵の駒に重ねて移動＝攻撃する前に、相手の中身を見てから決められるようにするため）。
let bbPendingDetailConfirm = null;
// opts.onConfirm2/opts.confirmLabel2 を渡すと、2つ目の実行ボタンも表示される
// （例：種カレーが敵駒と隣接した時に「種発射」「戦闘を挑む」の両方を選べるようにするため）。
let bbPendingDetailConfirm2 = null;
function bbShowUnitDetail(unit, opts) {
    const overlay = document.getElementById('bbUnitDetailOverlay');
    const img = document.getElementById('bbUnitDetailImg');
    const nameEl = document.getElementById('bbUnitDetailName');
    const teamEl = document.getElementById('bbUnitDetailTeam');
    const statsEl = document.getElementById('bbUnitDetailStats');
    const confirmBtn = document.getElementById('bbUnitDetailConfirmBtn');
    const confirmBtn2 = document.getElementById('bbUnitDetailConfirmBtn2');
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
    const skillsEl = document.getElementById('bbUnitDetailSkills');
    if (skillsEl) skillsEl.innerHTML = bbRenderSkillsHtml(c);
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
    if (opts && typeof opts.onConfirm2 === 'function') {
        bbPendingDetailConfirm2 = opts.onConfirm2;
        if (confirmBtn2) {
            confirmBtn2.style.display = 'inline-block';
            confirmBtn2.textContent = opts.confirmLabel2 || '実行する';
        }
    } else {
        bbPendingDetailConfirm2 = null;
        if (confirmBtn2) confirmBtn2.style.display = 'none';
    }
    overlay.style.display = 'flex';
    // 戦闘フェーズ中なら、詳細カードを開いている間だけその駒の移動可能範囲を
    // チームカラーの枠でプレビュー表示する（配置フェーズでは移動の概念が無いため対象外）。
    // このカードは全画面オーバーレイなので、表示中は盤面のタップ自体ができない
    // （＝bbGetMovableNodeIdsの内部キャッシュbbLastMoveParentを一時的に書き換えても、
    // その間に手番中の駒を実際に動かされることはない。カードを閉じる際にbbCloseUnitDetail側で
    // 手番中の駒の移動可能範囲・キャッシュを確実に元通り計算し直す）。
    if (bbState.phase === 'battle' && unit.hp > 0 && unit.nodeId != null) {
        bbShowMoveRangePreview(unit);
    }
    // 詳細表示中は、行動順の帯（#bbTurnQueueBar）の中でその駒に対応するアイコンを
    // 光らせて、行動順の中での位置がひと目で分かるようにする（戦闘フェーズのみ意味を持つ）。
    bbHighlightTurnIcon(unit);
}
function bbConfirmUnitDetailAction() {
    const fn = bbPendingDetailConfirm;
    bbPendingDetailConfirm = null;
    bbPendingDetailConfirm2 = null;
    bbCloseUnitDetail();
    if (typeof fn === 'function') fn();
}
function bbConfirmUnitDetailAction2() {
    const fn = bbPendingDetailConfirm2;
    bbPendingDetailConfirm = null;
    bbPendingDetailConfirm2 = null;
    bbCloseUnitDetail();
    if (typeof fn === 'function') fn();
}
function bbCloseUnitDetail() {
    bbPendingDetailConfirm = null;
    bbPendingDetailConfirm2 = null;
    const overlay = document.getElementById('bbUnitDetailOverlay');
    if (overlay) overlay.style.display = 'none';
    bbClearMoveRangePreview();
    bbClearTurnIconHighlight();
    // 移動可能範囲プレビューの計算は、手番中の駒の移動可能マス・経路復元キャッシュ
    // （bbLastMoveParent）を一時的に上書きしてしまうため、自分の移動フェーズの最中に
    // 別の駒をプレビューしていた場合は、カードを閉じたタイミングで手番中の駒の分を
    // 必ず計算し直す（そうしないと、この後の移動先選択が誤った経路になってしまう。
    // 既にこのターン移動済みの場合は、移動可能マスは無いので再ハイライトしない）。
    if (bbState.phase === 'battle' && bbState.subPhase === 'move' && !bbState.hasMovedThisTurn
        && bbState.activeUnit && bbState.activeUnit.hp > 0) {
        bbHighlightMovableTiles(bbState.activeUnit);
    }
    // 「詳細」をコマンドメニューから開いていた場合は、閉じたタイミングで
    // 同じコマンドメニューへ自動的に戻る（詳細は行動として消費されないため）。
    if (bbCommandMenuReopenAfterDetail) {
        bbCommandMenuReopenAfterDetail = false;
        if (bbState.phase === 'battle' && bbState.activeUnit && bbState.activeUnit.hp > 0) {
            bbOpenCommandMenu(bbState.activeUnit);
        }
    }
}
// 詳細表示中、行動順の帯（#bbTurnQueueBar）の中でその駒に対応するアイコンを光らせる。
function bbHighlightTurnIcon(unit) {
    bbClearTurnIconHighlight();
    if (!unit || unit.uid == null) return;
    const bar = document.getElementById('bbTurnQueueBar');
    if (!bar) return;
    const el = bar.querySelector(`[data-bb-uid="${unit.uid}"]`);
    if (el) el.classList.add('bb-turnIcon-highlighted');
}
function bbClearTurnIconHighlight() {
    const bar = document.getElementById('bbTurnQueueBar');
    if (!bar) return;
    bar.querySelectorAll('.bb-turnIcon-highlighted').forEach(el => el.classList.remove('bb-turnIcon-highlighted'));
}
// 行動順の帯のアイコンをタップした場合も、その駒の詳細を開けるようにする。
function bbOnTapTurnIcon(uid) {
    const unit = bbState.units.find(u => u.uid === uid && u.hp > 0);
    if (unit) bbShowUnitDetail(unit);
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
    bbRenderRankLine('bbPrepRankLine');
    bbRenderAdminRankEditor();
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
    const skillsEl = document.getElementById('bbRegDetailSkills');
    if (skillsEl) skillsEl.innerHTML = bbRenderSkillsHtml(raw);
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
                <div id="bbPrepRankLine">ランク: F</div>
                <div id="bbAdminRankEditor">
                    <select id="bbAdminRankSelect"></select>
                    <select id="bbAdminStarsSelect"></select>
                    <button class="bb-actionBtn bb-small" onclick="window.__bbOnAdminSetRank()">（管理者）ランク設定</button>
                </div>
                <div id="bbPrepRosterList"></div>
                <div class="bb-prepBtnRow">
                    <button class="bb-actionBtn" onclick="window.__bbOnRegisterCurryClick()">カレー登録</button>
                    <button class="bb-actionBtn" id="bbBtnPrepStartBattle" disabled onclick="window.__bbOnPrepStartBattleClick()">準備完了</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOpenPrepPlacementEditor()">配置プリセット編集</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbShowRankRewards()">ランクアップ報酬</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbShowHelp()">カレーボードバトルとは？</button>
                </div>
            </div>
            <div id="bbBoardWrap">
                <svg id="bbBoardSvg" viewBox="0 0 600 900"><g id="bbViewportG"></g></svg>
                <div id="bbFxLayer"></div>
                <div id="bbOpponentBanner">
                    <img id="bbOpponentBannerImg" src="" alt="">
                    <div class="bb-opponentBannerName" id="bbOpponentBannerName"></div>
                </div>
            </div>
            <div id="bbTopOverlay">
                <div id="bbHeaderBar">
                    <h1>ボードカレーバトル</h1>
                    <div class="bb-header-right">
                        <span class="bb-devBadge">BETA版</span>
                        <button class="bb-muteBtn" onclick="window.__bbToggleMute()">
                            <img id="bbMuteIcon" src="sound-on.svg" alt="sound">
                        </button>
                        <button class="bb-closeBtn" id="bbCloseBtn" onclick="window.__bbOnHeaderCloseClick()">✕ 閉じる</button>
                    </div>
                </div>
                <div id="bbTurnQueueBar"></div>
                <div id="bbEnemyPreviewBar"></div>
            </div>
            <div id="bbBottomPanel">
                <div id="bbPlacementPanel">
                    <h2>配置フェーズ</h2>
                    <div id="bbBudgetLine">合計ステータス: 0 / 3000（残り3000）　配置数: 0 / 12</div>
                    <div id="bbPlaceHint">下のカレーをタップして選択 → 盤面の自陣側（青枠）マスをタップして配置します。</div>
                    <div id="bbRosterList"></div>
                    <div class="bb-prepBtnRow">
                        <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnSavePlacementClick()">配置登録</button>
                        <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnLoadPlacementClick()">配置呼出</button>
                        <button class="bb-actionBtn" id="bbBtnStartBattle" disabled onclick="window.__bbOnStartBattleClick()">バトル開始</button>
                    </div>
                </div>
                <div id="bbTrapPanel" style="display:none;">
                    <h2>トラップ設置フェーズ</h2>
                    <div id="bbTrapHint">好きなノーマルマスをタップすると、そこにバナナトラップ（バナナマス）を1つ設置できます。設置しなくても「バトル開始」で始められます。</div>
                    <div class="bb-prepBtnRow">
                        <button class="bb-actionBtn" id="bbBtnTrapStartBattle" onclick="window.__bbOnTrapStartBattleClick()">バトル開始</button>
                    </div>
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
                <div id="bbResultRankLine" style="font-size:12px; margin-bottom:16px; color:#f1c40f; font-weight:bold;"></div>
                <button class="bb-actionBtn" onclick="window.__bbBackToPrep()">戻る</button>
            </div>
        </div>
        <div id="bbBattleBlockOverlay"></div>
        <div id="bbBattleStartSplash">
            <div id="bbBattleStartSplashLine1">Curry Board Battle</div>
            <div id="bbBattleStartSplashLine2">START</div>
        </div>
        <div id="bbUnitDetailOverlay" onclick="if(event.target===this) window.__bbCloseUnitDetail()">
            <div id="bbUnitDetailBox" class="bb-boardCard">
                <button class="bb-cardCloseX" onclick="window.__bbCloseUnitDetail()" aria-label="閉じる">×</button>
                <div id="bbUnitDetailVisual"><img id="bbUnitDetailImg" src="" alt=""></div>
                <div id="bbUnitDetailTeam" class="bb-unitDetailTeam"></div>
                <h3 id="bbUnitDetailName"></h3>
                <div id="bbUnitDetailStats"></div>
                <div id="bbUnitDetailSkills"></div>
                <button class="bb-actionBtn" id="bbUnitDetailConfirmBtn" style="display:none;" onclick="window.__bbConfirmUnitDetailAction()">実行する</button>
                <button class="bb-actionBtn" id="bbUnitDetailConfirmBtn2" style="display:none;" onclick="window.__bbConfirmUnitDetailAction2()">実行する</button>
            </div>
        </div>
        <div id="bbCommandMenuOverlay">
            <div id="bbCommandMenuBox" class="bb-boardCard">
                <div id="bbCommandMenuVisual"><img id="bbCommandMenuImg" src="" alt=""></div>
                <h3 id="bbCommandMenuName"></h3>
                <div class="bb-cmdMenuList">
                    <button class="bb-actionBtn bb-cmdMenuBtn" id="bbCmdBtnChallenge" onclick="window.__bbOnCommandChallenge()">戦闘を挑む</button>
                    <button class="bb-actionBtn bb-cmdMenuBtn" id="bbCmdBtnSkill" onclick="window.__bbOnCommandSkill()">特技</button>
                    <button class="bb-actionBtn bb-cmdMenuBtn" id="bbCmdBtnWait" onclick="window.__bbOnCommandWait()">待機</button>
                    <button class="bb-actionBtn bb-cmdMenuBtn bb-secondary" id="bbCmdBtnDetail" onclick="window.__bbOnCommandDetail()">詳細</button>
                    <button class="bb-actionBtn bb-cmdMenuBtn bb-secondary" id="bbCmdBtnUndo" onclick="window.__bbOnCommandUndo()">戻す</button>
                </div>
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
                    <button class="bb-cardCloseX" onclick="window.__bbCloseRegDetail()" aria-label="閉じる">×</button>
                    <div id="bbRegDetailVisual"><img id="bbRegDetailImg" src="" alt=""></div>
                    <input id="bbRegDetailNameInput" type="text" maxlength="20" placeholder="カレー名" onblur="window.__bbOnChangeRegName()">
                    <div id="bbRegDetailStats"></div>
                    <div id="bbRegDetailSkills"></div>
                    <div class="bb-regEquipSectionLabel">ベース</div>
                    <div id="bbRegDetailBaseList" class="bb-regEquipOptionList"></div>
                    <div class="bb-regEquipSectionLabel">食器</div>
                    <div id="bbRegDetailTablewareList" class="bb-regEquipOptionList"></div>
                    <div class="bb-regDetailBtnRow">
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
                    <strong>【ご注意】</strong><br>
                    ボードカレーバトルはBETA版のコンテンツです。予告なく仕様は変更します。<br><br>
                    <strong>【ランク】</strong><br>
                    F→E→D→C→B→A→S→SSの8段階のランクがあります。対戦に勝つと★が1つ増え、負けると★が1つ減ります。★4つで1つ上のランクに、★0で1つ下のランクになります。現在のランクはカレー準備画面で確認でき、「ランクアップ報酬」から到達済みランクの報酬を受け取れます。<br><br>
                    <strong>【ルール】</strong><br>
                    相手の陣地の「旗」を奪うか、相手の駒を全滅させれば勝利です。<br>
                    ・「カレー登録」で、カレーストックからボードバトル専用にカレーを登録できます（登録すると通常のストックからは無くなります。最大20個まで）。<br>
                    ・登録したカレーは名前の変更や、ベース・食器の個別装備ができます（本編の装備とは別枠です）。<br>
                    ・「準備完了」を押すと対戦相手を選び、配置フェーズになります。登録済みのカレーの中から、ステータス合計3000・最大12体まで盤面の自陣側に配置してください。<br>
                    ・配置が終わったら「戦闘開始」でボードバトルスタート。<br>
                    ・移動は上下左右のみ（斜め移動は不可）。SPDが高いほど1回に動けるマス数が増え、他の駒がいるマスは通り抜けられません。<br>
                    ・盤面には「岩」「水」「毒」の特殊マスがあります。岩と水は特定のカレー以外通過できません。毒は通過時にダメージを受けます。<br>
                    ・バナナトラップ持ちのカレーが編成にいる場合、配置後に「バナナマス」を盤面の好きなノーマルマスに1つ設置できます。バナナマスは必ず停止しなくてはならないマスで、誰かが乗ると効果音とともにノーマルマスに戻ります。<br>
                    ・移動後、隣接する敵駒に対戦を挑むことができ、本編同様の戦闘画面で1対1のバトルが始まります。負けた駒は消滅します。勝利した駒は盤に残りますが、減ったHPはそのままです。<br>
                    ・特技を持つ特殊カレーもいます。<br>
                    ●「種発射」：直線3マス以内の敵への遠距離攻撃<br>
                    ●「岩砕き」：隣接する岩を砕く<br>
                    ●「水泳」：水マスに通過・停止ができる<br>
                    ●「ホームラン」：特定の攻撃を無効化<br>
                    ●「盾ガード」：特定の攻撃を無効化<br>
                    ●「毒耐性」：毒マスのダメージを受けない<br>
                    ●「ヒリヒリクラッシュ」：自分と上下左右の全ての駒に50ダメージ<br>
                    ●「バナナトラップ」：バナナトラップを設置できる<br>
                    ●「ネバネバクダン」：1度だけダメージ+1回休みを付与できる<br>
                    ●「太陽の恵み」：毎ターンHPを少し回復<br>
                    ●「ふわとろバリア」：自分と隣接する仲間のダメージを軽減
                </div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseHelp()">閉じる</button>
            </div>
        </div>
        <div id="bbRankRewardsOverlay" onclick="if(event.target===this) window.__bbCloseRankRewards()">
            <div id="bbRankRewardsBox">
                <h3>ランクアップ報酬</h3>
                <div id="bbRankRewardsList"></div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseRankRewards()">閉じる</button>
            </div>
        </div>
        <div id="bbOpponentSelectOverlay" onclick="if(event.target===this) window.__bbCloseOpponentSelect()">
            <div id="bbOpponentSelectBox">
                <h3>対戦相手を選ぶ</h3>
                <div id="bbOpponentSelectList"></div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbCloseOpponentSelect()">戻る</button>
            </div>
        </div>
        <div id="bbPlacementPresetOverlay" onclick="if(event.target===this) window.__bbClosePlacementPresetOverlay()">
            <div id="bbPlacementPresetBox">
                <h3 id="bbPlacementPresetTitle">配置を呼び出す</h3>
                <div id="bbPlacementPresetHint"></div>
                <div id="bbPlacementPresetList"></div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbClosePlacementPresetOverlay()">閉じる</button>
            </div>
        </div>
        <div id="bbPlacementSaveNameOverlay" onclick="if(event.target===this) window.__bbClosePlacementSaveNameOverlay()">
            <div id="bbPlacementSaveNameBox">
                <h3>配置を登録</h3>
                <input id="bbPlacementSaveNameInput" type="text" maxlength="20" placeholder="配置の名前（未入力可）">
                <button class="bb-actionBtn" onclick="window.__bbConfirmSavePlacement()">登録する</button>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbClosePlacementSaveNameOverlay()">キャンセル</button>
            </div>
        </div>
        <div id="bbInfoPopupOverlay" onclick="if(event.target===this) window.__bbCloseInfoPopup()">
            <div id="bbInfoPopupBox">
                <div id="bbInfoPopupText"></div>
                <button class="bb-actionBtn" onclick="window.__bbCloseInfoPopup()">OK</button>
            </div>
        </div>
        <div id="bbPrepPlacementEditorOverlay" onclick="if(event.target===this) window.__bbClosePrepPlacementEditor()">
            <div id="bbPrepPlacementEditorBox">
                <h3>配置プリセット編集</h3>
                <div id="bbPrepEditorHint">下のカレーをタップして選択 → マスをタップして配置します。配置済みのマスはタップで外せます（実際の対戦相手選びの前に、配置だけを組んで保存できます）。</div>
                <div id="bbPrepEditorBudgetLine">合計ステータス: 0 / 3000（残り3000）　配置数: 0 / 12</div>
                <div id="bbPrepEditorGrid"></div>
                <div id="bbPrepEditorRosterList"></div>
                <div class="bb-prepBtnRow">
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnPrepEditorSaveClick()">プリセット保存</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnPrepEditorLoadClick()">プリセット呼出</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnPrepEditorClearClick()">クリア</button>
                </div>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbClosePrepPlacementEditor()">閉じる</button>
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

    // 盤の上に表示されるカード（コマンドメニュー・駒の詳細）はドラッグで動かせるようにする。
    bbMakeCardDraggable(document.getElementById('bbCommandMenuBox'));
    bbMakeCardDraggable(document.getElementById('bbUnitDetailBox'));

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
window.__bbOnSavePlacementClick = bbOnSavePlacementClick;
window.__bbOnLoadPlacementClick = bbOnLoadPlacementClick;
window.__bbClosePlacementPresetOverlay = bbClosePlacementPresetOverlay;
window.__bbOnPlacementPresetRowClick = bbOnPlacementPresetRowClick;
window.__bbOnDeletePlacementPreset = bbOnDeletePlacementPreset;
window.__bbClosePlacementSaveNameOverlay = bbClosePlacementSaveNameOverlay;
window.__bbCloseInfoPopup = bbCloseInfoPopup;
window.__bbConfirmSavePlacement = bbConfirmSavePlacement;
window.__bbClose = bbClose;
window.__bbRestart = bbRestart;
window.__bbBackToPrep = bbBackToPrep;
window.__bbToggleMute = bbToggleMute;
window.__bbOnHeaderCloseClick = bbOnHeaderCloseClick;
window.__bbCloseUnitDetail = bbCloseUnitDetail;
window.__bbConfirmUnitDetailAction = bbConfirmUnitDetailAction;
window.__bbConfirmUnitDetailAction2 = bbConfirmUnitDetailAction2;
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
window.__bbShowRankRewards = bbShowRankRewards;
window.__bbCloseRankRewards = bbCloseRankRewards;
window.__bbOnClaimRankReward = bbOnClaimRankReward;
window.__bbOnAdminSetRank = bbOnAdminSetRank;
window.__bbCloseOpponentSelect = bbCloseOpponentSelect;
window.__bbSelectOpponentBot = bbSelectOpponentBot;
window.__bbOnCommandChallenge = bbOnCommandChallenge;
window.__bbOnCommandSkill = bbOnCommandSkill;
window.__bbOnCommandWait = bbOnCommandWait;
window.__bbOnCommandDetail = bbOnCommandDetail;
window.__bbOnCommandUndo = bbOnCommandUndo;
window.__bbOnTapTurnIcon = bbOnTapTurnIcon;
window.__bbOpenPrepPlacementEditor = bbOpenPrepPlacementEditor;
window.__bbClosePrepPlacementEditor = bbClosePrepPlacementEditor;
window.__bbOnPrepEditorPickRosterCurry = bbOnPrepEditorPickRosterCurry;
window.__bbOnPrepEditorCellClick = bbOnPrepEditorCellClick;
window.__bbOnPrepEditorClearClick = bbOnPrepEditorClearClick;
window.__bbOnPrepEditorSaveClick = bbOnPrepEditorSaveClick;
window.__bbOnPrepEditorLoadClick = bbOnPrepEditorLoadClick;
window.__bbOnTrapStartBattleClick = bbOnTrapStartBattleClick;
window.openBoardBattle = bbOpen; // 将来、他の場所（正式な入り口ボタン等）から開けるように

// board-battle.js自体は本編game.htmlの読み込み時に常に読み込まれるスクリプトなので、
// ここで無条件に一度呼んでおくことで「異常終了（決闘中にページを閉じる／リロードする等）で
// 一時カレー（__isBoardBattleTemp）がcurryStockに残ってしまう」問題を、
// ボードカレーバトルを開き直すのを待たず、次にページを開いた瞬間に掃除できるようにする。
bbCleanupLeakedTempCurries();

bbInjectDom();

})();
