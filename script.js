/*
 * note: 本プログラムはぷよぷよプログラミングのソースコードを参考にしています。商用利用はできません。
 */

phina.globalize();

var SCREEN_WIDTH    = 640;
var SCREEN_HEIGHT   = 960;

var CONFIG_PUYO_IMG_WIDTH  = 68; // ぷよぷよ画像の幅
var CONFIG_PUYO_IMG_HEIGHT = 68; // ぷよぷよ画像の高さ
var CONFIG_STAGE_COLS = 6;
var CONFIG_STAGE_ROWS = 12;

var CONFIG_FREE_FALLING_SPEED = 16; // 自由落下のスピード
var CONFIG_ERASE_PUYO_COUNT = 4; // 何個以上揃ったら消えるか
var CONFIG_ERASE_ANIMATION_DURATION = 30; // 何フレームでぷよを消すか

var CONFIG_PUYO_COLORS = 4; // 何色のぷよを使うか
var CONFIG_PLAYER_FALLING_SPEED = 2.0; // プレイ中の自然落下のスピード
var CONFIG_PLAYER_DOWN_SPEED = 10; // プレイ中の下キー押下時の落下スピード
var CONFIG_PLAYER_GROUND_FRAME = 20; // 何フレーム接地したらぷよを固定するか
var CONFIG_PLAYER_MOVE_FRAME = 10; // 左右移動に消費するフレーム数
var CONFIG_PLAYER_ROTATE_FRAME = 10; // 回転に消費するフレーム数

var BLOCK_SIZE      = 64;
var PADDLE_WIDTH    = 150;
var PADDLE_HEIGHT   = 32;
var BALL_RADIUS     = 16;
var BALL_SPEED      = 16;


var BOARD_SIZE      = CONFIG_PUYO_IMG_WIDTH * CONFIG_STAGE_COLS;
var BOARD_PADDING   = (SCREEN_WIDTH - BOARD_SIZE) / 2;
var BOARD_OFFSET_X  = BOARD_PADDING;
var BOARD_OFFSET_Y  = 100;

class Stage{
  constructor() {
    this.fallingPuyoList = [];
    this.erasingPuyoInfoList = [];
    this.puyoCount = 0;
  }

  initialize(group)
  {
    this.board = [
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
    ];

    this.group = group;

    let puyoCount = 0;
    for(let y = 0; y < CONFIG_STAGE_ROWS; y++) {
      const line = this.board[y] || (this.board[y] = []);
      for(let x = 0; x < CONFIG_STAGE_COLS; x++) {
        const puyo = line[x];
        if(puyo >= 1 && puyo <= 5) {
          this.setPuyo(x, y, puyo);
          puyoCount++;
        } else {
          line[x] = 0;
        }
      }
    }
    this.puyoCount = puyoCount;  
  }

  Board(x,y){
    return this.board[y][x];
  }


  // 画面とメモリ両方に puyo をセットする
  setPuyo(x, y, puyo) {
    // 画像を作成し配置する
    let idx = y * CONFIG_STAGE_COLS + x;
    var p = this.group.children.find(function(elm) {return elm.getIndex() == idx;});
    p.alpha = 1.0;
    p.setColor(puyo);

    // メモリにセットする
    this.board[y][x] = puyo;
  }
  
  // 透明度だけ変える
  setPuyoAlpha(x, y, alpha){
    let idx = y * CONFIG_STAGE_COLS + x;
    var p = this.group.children.find(function(elm) {return elm.getIndex() == idx;});
    p.alpha = alpha;
  }

  // 自由落下をチェックする
  checkFall(){
    this.fallingPuyoList.length = 0;
    let isFalling = false;

    // 下の行から上の行を見ていく
    for(let y = CONFIG_STAGE_ROWS - 2; y >= 0; y--) {
      const line = this.board[y];
      for(let x = 0; x < line.length; x++) {
        if(this.board[y][x] == 0) {continue;}// このマスにぷよがなければ次

        if(this.board[y + 1][x] == 0) {
          // このぷよは落ちるので、取り除く
          let cell = this.board[y][x];
          this.board[y][x] = 0;
          let dst = y;
          while(dst + 1 < CONFIG_STAGE_ROWS && this.board[dst + 1][x] == 0) {
            dst++;
          }
          // 最終目的地に置く
          this.setPuyo(x, dst, cell);
          this.setPuyoAlpha(x, dst, 0.0);
//          this.board[dst][x] = cell;
          // 落ちるリストに入れる
          this.fallingPuyoList.push({
            color: cell,
            x: x,
            y: y,
            dst: dst,
            position: y * CONFIG_PUYO_IMG_HEIGHT,
            destination: dst * CONFIG_PUYO_IMG_HEIGHT,
            falling: true
          });
          // 落ちるものがあったことを記録しておく
          isFalling = true;
        }
      }
    }
    return isFalling ? this.fallingPuyoList: null;
  }

  // 自由落下させる
  fall(falling_group) {
    let Stage = this;
    let isFalling = false;
    falling_group.y += CONFIG_FREE_FALLING_SPEED;
    falling_group.children.each(function(puyo) {
      let position = puyo.info.position;
      position += CONFIG_FREE_FALLING_SPEED;
      if(puyo.info.destination <= position) {
        // 自由落下終了
        puyo.info.departure = puyo.info.destination;
        puyo.remove();
        // 固定ぷよを表示する
//        Stage.setPuyo(puyo.info.x, puyo.info.dst, puyo.info.color);
      } else {
        // まだ落下しているぷよがあることを記録する
        isFalling = true;
        puyo.info.position = position;
      }
    }); 

    return isFalling;
  }

  // 消せるかどうか判定する
  checkErase(startFrame) {
    this.eraseStartFrame = startFrame;
    this.erasingPuyoInfoList.length = 0;

    // 何色のぷよを消したかを記録する
    const erasedPuyoColor = {};

    // 隣接ぷよを確認する関数内関数を作成
    const sequencePuyoInfoList = [];
    const existingPuyoInfoList = [];
    const checkSequentialPuyo = (x, y) => {
      // ぷよがあるか確認する
      const orig = this.board[y][x];
      if(orig == 0) {
        // ないなら何もしない
        return;
      }
      // あるなら一旦退避して、メモリ上から消す
      const puyo = this.board[y][x];
      sequencePuyoInfoList.push({
        x: x,
        y: y,
        cell: this.board[y][x]
      });
      this.board[y][x] = 0;
      // 四方向の周囲ぷよを確認する
      const direction = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for(let i = 0; i < direction.length; i++) {
        const dx = x + direction[i][0];
        const dy = y + direction[i][1];
        if(dx < 0 || dy < 0 || dx >= CONFIG_STAGE_COLS || dy >= CONFIG_STAGE_ROWS) {
          // ステージの外にはみ出た
          continue;
        }
        const cell = this.board[dy][dx];
        if(!cell || cell != puyo) {
          // ぷよの色が違う
          continue;
        }
        // そのぷよのまわりのぷよも消せるか確認する
        checkSequentialPuyo(dx, dy);
      };
    };
 
    // 実際に削除できるかの確認を行う
    for(let y = 0; y < CONFIG_STAGE_ROWS; y++) {
      for(let x = 0; x < CONFIG_STAGE_COLS; x++) {
        sequencePuyoInfoList.length = 0;
        const puyoColor = this.board[y][x];
        if(0==puyoColor)continue;
        checkSequentialPuyo(x, y);
        if(sequencePuyoInfoList.length == 0 || sequencePuyoInfoList.length < CONFIG_ERASE_PUYO_COUNT) {
          // 連続して並んでいる数が足りなかったので消さない
          if(sequencePuyoInfoList.length) {
            // 退避していたぷよを消さないリストに追加する
            existingPuyoInfoList.push(...sequencePuyoInfoList);
          }
        } else {
          // これらは消して良いので消すリストに追加する
          this.erasingPuyoInfoList.push(...sequencePuyoInfoList);
          erasedPuyoColor[puyoColor] = true;
        }
      }
    }
    this.puyoCount -= this.erasingPuyoInfoList.length;
    // 消さないリストに入っていたぷよをメモリに復帰させる
    for(const info of existingPuyoInfoList) {
      this.board[info.y][info.x] = info.cell;
    }
    if(this.erasingPuyoInfoList.length) {
      // もし消せるならば、消えるぷよの個数と色の情報をまとめて返す
      return {
        piece: this.erasingPuyoInfoList.length,
        color: Object.keys(erasedPuyoColor).length
      };
    }
    return null;
  }

  // 消すアニメーションをする
  erasing(frame) {

    const elapsedFrame = frame - this.eraseStartFrame;
    const ratio = elapsedFrame / CONFIG_ERASE_ANIMATION_DURATION;
    if(ratio > 1) {
      // アニメーションを終了する
      for(const info of this.erasingPuyoInfoList) {
        this.setPuyoAlpha(info.x, info.y, 0.0);
      }
      return false;
    } else if(ratio > 0.75) {
      for(const info of this.erasingPuyoInfoList) {
        this.setPuyoAlpha(info.x, info.y, 1.0);
      }
      return true;
    } else if(ratio > 0.50) {
      for(const info of this.erasingPuyoInfoList) {
        this.setPuyoAlpha(info.x, info.y, 0.0);
      }
      return true;
    } else if(ratio > 0.25) {
      for(const info of this.erasingPuyoInfoList) {
        this.setPuyoAlpha(info.x, info.y, 1.0);
      }
      return true;
    } else {
      for(const info of this.erasingPuyoInfoList) {
        this.setPuyoAlpha(info.x, info.y, 0.0);
      }
      return true;
    }
  }

  showZenkeshi() {
    // 全消しを表示する
    this.zenkeshiImage.style.display = 'block';
    this.zenkeshiImage.style.opacity = '1';
    const startTime = Date.now();
    const startTop = Config.puyoImgHeight * CONFIG_STAGE_ROWS;
    const endTop = Config.puyoImgHeight * CONFIG_STAGE_ROWS / 3;
    const animation = () => {
      const ratio = Math.min((Date.now() - startTime) / Config.zenkeshiDuration, 1);
      this.zenkeshiImage.style.top = (endTop - startTop) * ratio + startTop + 'px';
      if(ratio !== 1) {
        requestAnimationFrame(animation);
      }
    };
    animation();
  }

  hideZenkeshi() {
    // 全消しを消去する
    const startTime = Date.now();
    const animation = () => {
      const ratio = Math.min((Date.now() - startTime) / Config.zenkeshiDuration, 1);
      this.zenkeshiImage.style.opacity = String(1 - ratio);
      if(ratio !== 1) {
        requestAnimationFrame(animation);
      } else {
        this.zenkeshiImage.style.display = 'none';
      }
    };
    animation();
  }
};

class Player{
  constructor(stage) {
    this.Stage = stage;
  }

  createNewPuyo (scene) {
    // ぷよぷよが置けるかどうか、1番上の段の左から3つ目を確認する
    if(this.Stage.Board(2, 0)) {
      // 空白でない場合は新しいぷよを置けない
      return false;
    }
    // 新しいぷよの色を決める
    const puyoColors = Math.max(1, Math.min(5, CONFIG_PUYO_COLORS));
    this.centerPuyo = Math.floor(Math.random() * puyoColors) + 1;
    this.movablePuyo = Math.floor(Math.random() * puyoColors) + 1;
    // 新しいぷよ画像を作成する

    let centerPuyo = scene.centerPuyo;
    centerPuyo.setColor(this.centerPuyo);
    centerPuyo.alpha = 1.0;
    let movablePuyo = scene.movablePuyo;
    movablePuyo.setColor(this.movablePuyo);
    movablePuyo.alpha = 1.0;

//    this.centerPuyoElement = PuyoImage.getPuyo(this.centerPuyo);
//    this.movablePuyoElement = PuyoImage.getPuyo(this.movablePuyo);
//    this.Stage.stageElement.appendChild(this.centerPuyoElement);
//    this.Stage.stageElement.appendChild(this.movablePuyoElement);
    
    // ぷよの初期配置を定める
    this.puyoStatus = {
      x: 2, // 中心ぷよの位置: 左から2列目
      y: -1, // 画面上部ギリギリから出てくる
      left: 2 * CONFIG_PUYO_IMG_WIDTH,
      top:  -1 * CONFIG_PUYO_IMG_HEIGHT, 
      dx: 0, // 動くぷよの相対位置: 動くぷよは上方向にある
      dy: -1,
      rotation: 90 // 動くぷよの角度は90度（上向き）
    };
    
    // 接地時間はゼロ
    this.groundFrame = 0;
    
    // ぷよを描画
    this.setPuyoPosition(scene);
    
    return true;
  }

  setPuyoPosition (scene) {

    scene.centerPuyo.setPosition(
      this.puyoStatus.left + BOARD_OFFSET_X + CONFIG_PUYO_IMG_WIDTH / 2, 
      this.puyoStatus.top  + BOARD_OFFSET_Y + CONFIG_PUYO_IMG_HEIGHT / 2
      );

    const x = this.puyoStatus.left + Math.cos(this.puyoStatus.rotation * Math.PI / 180) * CONFIG_PUYO_IMG_WIDTH;
    const y = this.puyoStatus.top  - Math.sin(this.puyoStatus.rotation * Math.PI / 180) * CONFIG_PUYO_IMG_HEIGHT;

    scene.movablePuyo.setPosition(
      x + BOARD_OFFSET_X + CONFIG_PUYO_IMG_WIDTH / 2, 
      y + BOARD_OFFSET_Y + CONFIG_PUYO_IMG_HEIGHT / 2);

//    this.centerPuyoElement.style.left = this.puyoStatus.left + 'px';
//    this.centerPuyoElement.style.top = this.puyoStatus.top + 'px';
//    this.movablePuyoElement.style.left = x + 'px';
//    this.movablePuyoElement.style.top = y + 'px';
  }

  falling (isDownPressed) {
    // 現状の場所の下にブロックがあるかどうか確認する
    let isBlocked = false;
    let x = this.puyoStatus.x;
    let y = this.puyoStatus.y;
    let dx = this.puyoStatus.dx;
    let dy = this.puyoStatus.dy;
    if(y + 1 >= CONFIG_STAGE_ROWS || this.Stage.Board(x, y+1) ||
       (y + dy + 1 >= 0 && (y + dy + 1 >= CONFIG_STAGE_ROWS || this.Stage.Board(x + dx, y + dy + 1)))) {
      isBlocked = true;
    }
    if(!isBlocked) {
      // 下にブロックがないなら自由落下してよい。プレイヤー操作中の自由落下処理をする
      this.puyoStatus.top += CONFIG_PLAYER_FALLING_SPEED;
      if(isDownPressed) {
        // 下キーが押されているならもっと加速する
        this.puyoStatus.top += CONFIG_PLAYER_DOWN_SPEED;
      }
      if(Math.floor(this.puyoStatus.top / CONFIG_PUYO_IMG_HEIGHT) != y) {
        // ブロックの境を超えたので、再チェックする
        // 下キーが押されていたら、得点を加算する
        if(isDownPressed) {
          this.score += 1;
        }
        y += 1;
        this.puyoStatus.y = y;
        if(y + 1 >= CONFIG_STAGE_ROWS || this.Stage.Board(x, y + 1) 
        || (y + dy + 1 >= 0 && (y + dy + 1 >= CONFIG_STAGE_ROWS || this.Stage.Board(x + dx, y + dy + 1)))) {
          isBlocked = true;
        }
        if(!isBlocked) {
          // 境を超えたが特に問題はなかった。次回も自由落下を続ける
          this.groundFrame = 0;
          return;
        } else {
          // 境を超えたらブロックにぶつかった。位置を調節して、接地を開始する
          this.puyoStatus.top = y * CONFIG_PUYO_IMG_HEIGHT;
          this.groundFrame = 1;
          return;
        }
      } else {
        // 自由落下で特に問題がなかった。次回も自由落下を続ける
        this.groundFrame = 0;
        return;
      }
    }
    if(this.groundFrame == 0) {
      // 初接地である。接地を開始する
      this.groundFrame = 1;
      return;
    } else {
      this.groundFrame++;
      if(this.groundFrame > CONFIG_PLAYER_GROUND_FRAME) {
        return true;
      }
    }
  }

  playing(frame, keyboard, scene) {
    // まず自由落下を確認する
    // 下キーが押されていた場合、それ込みで自由落下させる
    if(this.falling(keyboard.getKey("down"))) {
      // 落下が終わっていたら、ぷよを固定する
      this.setPuyoPosition(scene);
      return 'fix';
    }
    this.setPuyoPosition(scene);
    if(keyboard.getKeyDown("right") || keyboard.getKeyDown("left")) {
      // 左右の確認をする
      const cx = (keyboard.getKeyDown("right")) ? 1 : -1;
      const x = this.puyoStatus.x;
      const y = this.puyoStatus.y;
      const mx = x + this.puyoStatus.dx;
      const my = y + this.puyoStatus.dy;
      // その方向にブロックがないことを確認する
      // まずは自分の左右を確認
      let canMove = true;
      if(y < 0 || x + cx < 0 || x + cx >= CONFIG_STAGE_COLS || this.Stage.Board(x + cx, y)) {
        if(y >= 0) {
          canMove = false;
        }
      }
      if(my < 0 || mx + cx < 0 || mx + cx >= CONFIG_STAGE_COLS || this.Stage.Board(mx + cx,my)) {
        if(my >= 0) {
          canMove = false;
        }
      }
      // 接地していない場合は、さらに1個下のブロックの左右も確認する
      if(this.groundFrame === 0) {
        if(y + 1 < 0 || x + cx < 0 || x + cx >= CONFIG_STAGE_COLS || this.Stage.Board(x + cx, y + 1)) {
          if(y + 1 >= 0) {
            canMove = false;
          }
        }
        if(my + 1 < 0 || mx + cx < 0 || mx + cx >= CONFIG_STAGE_COLS || this.Stage.Board(mx + cx, my+1)) {
          if(my + 1 >= 0) {
            canMove = false;
          }
        }
      }
      if(canMove) {
        // 動かすことが出来るので、移動先情報をセットして移動状態にする
        this.actionStartFrame = frame;
        this.moveSource = x * CONFIG_PUYO_IMG_WIDTH;
        this.moveDestination = (x + cx) * CONFIG_PUYO_IMG_WIDTH;
        this.puyoStatus.x += cx;
        return 'moving';
      }
    } else if(keyboard.getKeyDown("up")) {
      // 回転を確認する
      // 回せるかどうかは後で確認。まわすぞ
      const x = this.puyoStatus.x;
      const y = this.puyoStatus.y;
      const mx = x + this.puyoStatus.dx;
      const my = y + this.puyoStatus.dy;
      const rotation = this.puyoStatus.rotation;
      let canRotate = true;
      let cx = 0;
      let cy = 0;
      if(rotation === 0) {
        // 右から上には100% 確実に回せる。何もしない
      } else if(rotation === 90) {
        // 上から左に回すときに、左にブロックがあれば右に移動する必要があるのでまず確認する
        if(y + 1 < 0 || x - 1 < 0 || x - 1 >= CONFIG_STAGE_COLS || this.Stage.Board(x - 1, y + 1)) {
          if(y + 1 >= 0) {
            // ブロックがある。右に1個ずれる
            cx = 1;
          }
        }
        // 右にずれる必要がある時、右にもブロックがあれば回転出来ないので確認する
        if(cx === 1) {
          if(y + 1 < 0 || x + 1 < 0 || y + 1 >= CONFIG_STAGE_ROWS || x + 1 >= CONFIG_STAGE_COLS 
            || this.Stage.Board(x + 1, y + 1)) {
            if(y + 1 >= 0) {
              // ブロックがある。回転出来なかった
              canRotate = false;
            }
          }
        }
      } else if(rotation === 180) {
        // 左から下に回す時には、自分の下か左下にブロックがあれば1個上に引き上げる。まず下を確認する
        if(y + 2 < 0 || y + 2 >= CONFIG_STAGE_ROWS || this.Stage.Board(x, y + 2)) {
          if(y + 2 >= 0) {
            // ブロックがある。上に引き上げる
            cy = -1;
          }
        }
        // 左下も確認する
        if(y + 2 < 0 || y + 2 >= CONFIG_STAGE_ROWS || x - 1 < 0 || this.Stage.Board(x - 1, y + 2)) {
          if(y + 2 >= 0) {
            // ブロックがある。上に引き上げる
            cy = -1;
          }
        }
      } else if(rotation === 270) {
        // 下から右に回すときは、右にブロックがあれば左に移動する必要があるのでまず確認する
        if(y + 1 < 0 || x + 1 < 0 || x + 1 >= CONFIG_STAGE_COLS || this.Stage.Board(x + 1, y + 1)) {
          if(y + 1 >= 0) {
            // ブロックがある。左に1個ずれる
            cx = -1;
          }
        }
        // 左にずれる必要がある時、左にもブロックがあれば回転出来ないので確認する
        if(cx === -1) {
          if(y + 1 < 0 || x - 1 < 0 || x - 1 >= CONFIG_STAGE_COLS || this.Stage.Board(x - 1, y + 1)) {
            if(y + 1 >= 0) {
              // ブロックがある。回転出来なかった
              canRotate = false;
            }
          }
        }
      }
       
      if(canRotate) {
        // 上に移動する必要があるときは、一気にあげてしまう
        if(cy === -1) {
          if(this.groundFrame > 0) {
            // 接地しているなら1段引き上げる
            this.puyoStatus.y -= 1;
            this.groundFrame = 0;
          }
          this.puyoStatus.top = this.puyoStatus.y * CONFIG_PUYO_IMG_HEIGHT;
        }
        // 回すことが出来るので、回転後の情報をセットして回転状態にする
        this.actionStartFrame = frame;
        this.rotateBeforeLeft = x * CONFIG_PUYO_IMG_WIDTH;
        this.rotateAfterLeft = (x + cx) * CONFIG_PUYO_IMG_WIDTH;
        this.rotateFromRotation = this.puyoStatus.rotation;
        // 次の状態を先に設定しておく
        this.puyoStatus.x += cx;
        const distRotation = (this.puyoStatus.rotation + 90) % 360;
        const dCombi = [[1, 0], [0, -1], [-1, 0], [0, 1]][distRotation / 90];
        this.puyoStatus.dx = dCombi[0];
        this.puyoStatus.dy = dCombi[1];
        return 'rotating';
      }
    }
    return 'playing';
  }
          
  moving(frame, scene) {
    // 移動中も自然落下はさせる
    this.falling();
    const ratio = Math.min(1, (frame - this.actionStartFrame) / CONFIG_PLAYER_MOVE_FRAME);
    this.puyoStatus.left = ratio * (this.moveDestination - this.moveSource) + this.moveSource;
    this.setPuyoPosition(scene);
    if(ratio === 1) {
      return false;
    }
    return true;
  }
          
  rotating(frame, scene) {
    // 回転中も自然落下はさせる
    this.falling();
    const ratio = Math.min(1, (frame - this.actionStartFrame) / CONFIG_PLAYER_ROTATE_FRAME);
    this.puyoStatus.left = (this.rotateAfterLeft - this.rotateBeforeLeft) * ratio + this.rotateBeforeLeft;
    this.puyoStatus.rotation = this.rotateFromRotation + ratio * 90;
    this.setPuyoPosition(scene);
    if(ratio === 1) {
      this.puyoStatus.rotation = (this.rotateFromRotation + 90) % 360;
      return false;
    }
    return true;
  }

  fix(scene) {
    // 現在のぷよをステージ上に配置する
    const x = this.puyoStatus.x;
    const y = this.puyoStatus.y;
    const dx = this.puyoStatus.dx;
    const dy = this.puyoStatus.dy;
    if(y >= 0) {
      // 画面外のぷよは消してしまう
      this.Stage.setPuyo(x, y, this.centerPuyo);
      this.Stage.puyoCount++;
    }
    if(y + dy >= 0) {
      // 画面外のぷよは消してしまう
      this.Stage.setPuyo(x + dx, y + dy, this.movablePuyo);
      this.Stage.puyoCount++;
    }
    // 操作用に作成したぷよ画像を消す
    scene.centerPuyo.alpha = 0.0;
    scene.movablePuyo.alpha = 0.0;
  }  
};

phina.define("MainScene", {
  superClass: 'DisplayScene',

  // 初期化
  init: function(options) {
    this.superInit(options);

    // 状態
    this.state = 'start';

    // 背景
    this.bg = BG().addChildTo(this);

    // グループ
    this.group = DisplayElement().addChildTo(this);
 
    // ぷよをひとまず配置しておく
    (CONFIG_STAGE_COLS*CONFIG_STAGE_ROWS).times(function(i) {
      // グリッド上でのインデックス
      var xIndex = i % CONFIG_STAGE_COLS;
      var yIndex = Math.floor(i / CONFIG_STAGE_COLS);
      var puyo = Puyo(i, xIndex+1).addChildTo(this.group);

      puyo.x = CONFIG_PUYO_IMG_WIDTH  * xIndex + BOARD_OFFSET_X + CONFIG_PUYO_IMG_WIDTH/2;
      puyo.y = CONFIG_PUYO_IMG_HEIGHT * yIndex + BOARD_OFFSET_Y + CONFIG_PUYO_IMG_HEIGHT/2;
      puyo.alpha = 0.0;
    }, this);

    this.centerPuyo = new Puyo(-1, 1).addChildTo(this);
    this.movablePuyo = new Puyo(-2, 1).addChildTo(this);

    // ステージを準備する
    this.stage = new Stage();
    this.stage.initialize(this.group);

    // プレイヤーを準備する
    this.player = new Player(this.stage);

    // フレーム数
    this.frame = 0;

    // 連鎖数
    this.combinationCount = 0;
    
    // スコアラベル
    this.scoreLabel = Label('0').addChildTo(this);
    this.scoreLabel.x = this.gridX.center();
    this.scoreLabel.y = this.gridY.span(1);
    this.scoreLabel.fill = 'white';

    // スコア
    this.score = 0;
  },

  // メインループ
  update: function(app) {

    switch(this.state)
    {
      case 'start':
        this.state = 'checkFall';
        break;
      case 'checkFall':
        fallingPuyoList = this.stage.checkFall();
        this.falling_group = DisplayElement().addChildTo(this);
        if(fallingPuyoList){
          for(const info of fallingPuyoList) {
            var puyo = new Puyo(info.y * CONFIG_STAGE_COLS + info.x, info.color).addChildTo(this.falling_group);
            puyo.setPosition(
              CONFIG_PUYO_IMG_WIDTH  * info.x + BOARD_OFFSET_X + CONFIG_PUYO_IMG_WIDTH/2, 
              CONFIG_PUYO_IMG_HEIGHT * info.y + BOARD_OFFSET_Y + CONFIG_PUYO_IMG_HEIGHT/2);
            puyo.alpha = 1.0;
            puyo.info = info;
            // 元のぷよを消す
            this.stage.setPuyoAlpha(info.x, info.y, 0.0);
          }
          this.state = 'fall';
        }else{
          this.state = 'checkErase';
        }
        break;
      case 'fall':
        if(!this.stage.fall(this.falling_group)){//落ち切った
          this.falling_group.remove();
          this.falling_group = null;
          // きれいに消えなかったので、まとめて表示し直す
          for(let y = 0; y < CONFIG_STAGE_ROWS; y++) {
            for(let x = 0; x < CONFIG_STAGE_COLS; x++) {
              this.stage.setPuyoAlpha(x, y, this.stage.board[y][x] == 0 ? 0.0 : 1.0);
            }
          }
                
          this.state = 'checkErase';
        }
        break;
      case 'checkErase':
        eraseInfo = this.stage.checkErase(this.frame);
        if(eraseInfo){
          this.combinationCount++;
          this.score += this.calculateScore(this.combinationCount, eraseInfo.piece, eraseInfo.color);
//          this.stage.hideZenkeshi();
          this.state = 'erasing';
        }else{
          if(this.stage.puyoCount===0 && 0 < this.combinationCount){
//            this.stage.showZenkeshi();
            this.score += 3600;
          }
          combinationCount = 0;
          this.state = 'newPuyo';
        }
        break;
      case 'erasing':
        if(!this.stage.erasing(this.frame)){
          this.state = 'checkFall';// 消し終わったら、再度落ちるか判定
        }
        break;
      case 'newPuyo':
        if(!this.player.createNewPuyo(this)) {
          this.state = 'gameOver';
        }else{
          this.state = 'playing';
        }
        break;
      case 'playing':
        this.state = this.player.playing(this.frame, app.keyboard, this);// 'playing', 'moving', 'rotating', 'fix'
        break;
      case 'moving':
        if(!this.player.moving(this.frame, this)){
          this.state = 'playing';
        }
        break;
      case 'rotating':
        if(!this.player.rotating(this.frame, this)){
          this.state = 'playing';
        }
        break;
      case 'fix':
        this.player.fix(this);
        this.state = 'checkFall';
        break;
      case 'gameOver':
        this.gameover();
        break;
    }
    this.frame += app.deltaTime * 60.0;
  },

  calculateScore: function(rensa, piece, color) {
    const rensaBonus = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
    const pieceBonus = [0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10, 10];
    const colorBonus = [0, 0, 3, 6, 12, 24];

    rensa = Math.min(rensa, rensaBonus.length - 1);
    piece = Math.min(piece, pieceBonus.length - 1);
    color = Math.min(color, colorBonus.length - 1);
    let scale = rensaBonus[rensa] + pieceBonus[piece] + colorBonus[color];
    scale = Math.max(scale, 1);

    return scale * piece * 10;
  },

  gameover: function() {
    this.exit({
      score: this.score,
    });
  },

  _accessor: {
    score: {
      get: function() {
        return this._score;
      },
      set: function(v) {
        this._score = v;
        this.scoreLabel.text = v;
      },
    },
  }

});


/*
 * ぷよ
 */
phina.define('Puyo', {
  superClass: 'RectangleShape',

  init: function(index, color) {
    this.superInit({
      width: CONFIG_PUYO_IMG_WIDTH - 4,
      height: CONFIG_PUYO_IMG_HEIGHT - 4,
      stroke: null,
      cornerRadius: 8,
    });
    this.index = index;
    this.color = color;
    this.setColor(color);
  },

  getIndex(){
    return this.index;
  },

  setColor: function(c){
    this.color = c;
    switch(this.color)
    {
      case 0:this.fill = 'hsl(0, 0%, 0%)'; break;
      case 1:this.fill = 'hsl(0, 60%, 60%)'; break;
      case 2:this.fill = 'hsl(240, 60%, 60%)'; break;
      case 3:this.fill = 'hsl(120, 60%, 60%)'; break;
      case 4:this.fill = 'hsl(60, 60%, 60%)'; break;
      case 5:this.fill = 'hsl(180, 60%, 60%)'; break;
      case 6:this.fill = 'hsl(300, 60%, 60%)'; break;
    }
  }

});

phina.define('BG', {
  superClass: 'RectangleShape',

  init: function() {
    this.superInit({
      x: BOARD_OFFSET_X + BOARD_SIZE / 2,
      y: BOARD_OFFSET_Y + BOARD_SIZE,
      width: BOARD_SIZE,
      height: BOARD_SIZE * 2,
      fill: 'hsl({0}, 100%, 20%)',
      stroke: null,
      cornerRadius: 0,
    });
  },
});


phina.define("SplashScene", {
  // 継承
  superClass: 'DisplayScene',
  // 初期化
  init: function() {
    // 親クラス初期化
    this.superInit();
    // thisを退避
    var self = this;
    // 画面タッチ時
    this.onpointstart = function() {
      // ResultSceneへ
      self.exit();
    };
    // ラベル表示
    Label({
      text: '↑：回転\n← ↓ →：移動',
      fontSize: 64,
      fill: '#fff',
    }).addChildTo(this).setPosition(this.gridX.center(), this.gridY.center());
  },
});

phina.main(function() {
  // アプリケーションクラスの生成
  var app = GameApp({
    title: 'puyo',
    startLabel: location.search.substr(1).toObject().scene || 'splash',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#444',
    autoPause: true,
    debug: false,
  });

  app.enableStats(); // FPSを表示

  app.run();// ゲーム開始
});
