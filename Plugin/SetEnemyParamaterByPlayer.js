/*--------------------------------------------------------------------------
【概要】
敵のステータスをあるプレイヤーの現在のステータスで上書きするスクリプト．
つまりユニットを自分の育成した状態で敵に回せる．

プレイヤーの育成したユニット間の模擬戦や裏切りイベントで使えるかも．

敵だけじゃなくて同盟軍にも同じことができる．

【導入方法】
カスタムパラメータにユニットを記述すると，その指定されたユニットのパラメータで作成される．
参照元となるプレイヤーユニットは一度必ずパーティーに加えること．
一度パーティーに加えさえすればよいため出撃する必要はない．（仲間の追加→即非表示でも OK）

実験的に敵のレベルアップも行えるようになっています．
今のところ演出のないサイレントリーなレベルアップ．

【例】
例1:プレイヤー id:5 のキャラをエネミーとして登場
  {setEnemyParamByPlayer: {srcUnit : {unitType : 'player', id : 5}}

例2:キーワード「key」を用いてキャラをエネミーとして登場させる場合
  元となるユニットのカスタムパラメータ：{srcUnitKeyWord : 'key'}
  key のパラメータを使用するユニット：{setEnemyParamByPlayer:true, srcUnit : {unitType : 'player', keyWord : 'key'}}

【パラメータ詳細】
・必須パラメータ
setEnemyParamByPlayer : boolean : この機能を使用するか否か（true or false）

・ソース指定用のパラメータ
srcUnit : {unitType : 'player', id : number} : ソース・ユニットの ID（エディタ上で確認できるもの）
srcUnit : {unitType : 'player', name : 'name'} : ソース・ユニットの名前
srcUnit : {unitType : 'player', keyWord : 'key'} : ソース・ユニットのキーワード（→詳しくは補足項へ）
srcUnit : {unitType : 'player', pos : pos} : ソース・ユニットの位置（出撃時の並び順における順番）
srcUnit : {unitType : 'player', param : 'param'} : ソースとして使用するプレイヤーユニットのパラメータ条件
							: maxHp, maxAtk, maxDef, maxMat, maxMdf, etc... の条件を満たすユニットを検索

Player の部分を Ally, Enemy, All にするとそれぞれ同盟軍，敵軍，全軍のリストから検索可能．
（動作保証はできません．）

・キーワードの指定
srcUnitKeyWord : 'key'

########## 以下未実装 ############
・パラメータのコピー及びコピー後の扱い方
paramCopyRange : string : パラメータをコピーする範囲（param(dedault), state, all）
paramSyncRange : string : 同期させるパラメータの範囲 (none, param(default), state, all)

以下のパラメータがセットされた場合はそちらが優先となる．

isCopyHp
isSyncHP
isCopyMHp
isSyncMHP

・その他細かなパラメータ
isEnemyGrowth : boolean : 個別で is Growth が設定されていない場合経験値を得て成長させるか
notFoundSrcUnit : string : 対応するソースユニットが見つからない場合
        	      		 : erase : このユニットを削除, defaut : 元々設定されている値を使用
isAllowDopper : boolean: コピー元のユニットが出撃かつ生存の場合に出撃を許すか（false の場合削除扱いとなる）

・グローバル変数

isEnemyGrowthDefault : boolean : 個別で is Growth が設定されていない場合経験値を得て成長させるか
notFoundSrcUnitDefault : string : 対応するソースユニットが見つからない場合の動作
isAllowDopperDefault : boolean: コピー元のユニットが出撃かつ生存の場合に出撃を許すか（false の場合削除扱いとなる）
isCopyCurHpDefault : boolean : 現在の残り HP もコピーするか．（しない場合は全回復状態で設定）

#################################

【ソースの指定に関する補足】
・イベントユニットは Id で思ったものが取れるとは限らない
・All は KeyWord 以外うまく動く保証がない（Id や名前は被りやすいため）

・KeyWord はソースとして使用したいユニットのカスタムパラメータにsrcUnitKeyWord を記述しておく
例：{srcUnitKeyWord : 'keyWord'}

【パラメータのセット方法補足】
・copy と sync の違い
コピー先でパラメータに変化が発生したとき，元のパラメータに反映させるか否か
copy は反映させず、sync は反映させる．

・param, state, all の違い
none  : 行わない
param : hp, lv, exp, 力 etc... 辺りのパラメータ数字列
state : class, item
all   : 名前，説明文に至るまで

【更新履歴】
2020/11/09 : 初版

【対応バージョン】
SRPG Studio Version:1.213

--------------------------------------------------------------------------*/

(function() {
	var isEnemyGrowthDefault = true; // エネミーも経験値を得て成長させるか
	var notFoundSrcUnitDefault = 'default'; // 元のユニットが見つからない場合どうするか（erase にすすると削除）
	var isAllowDopperDefault = true; // 同時に出現を許すか（false にすると元のユニットが生きている場合削除扱いにする）
	var isCopyCurHpDefault = false; // 元の HP を残すか（true で HP もそのまま，false で全回復）

	// ユニットの値をコピー
	var alias = UnitProvider.setupFirstUnit;
	UnitProvider.setupFirstUnit = function(unit) {
		// カスタムパラメータに setParam があればパラメータのセットを行う
		if (isSettingEnemyParam(unit)) {
			// 元のユニットを取得
			var original = getSrcUnit(unit);

			if (typeof original !== 'number') {
				copyUnitData(unit, original);
					
				// 上限まで回復
				unit.setHp(ParamBonus.getMhp(unit));

				alive = original.getAliveState();
				sortie = original.getSortieState();
		
				if (alive !== AliveType.ALIVE && sortie === SortieType.SORTIE) {
					// 元のユニットが出撃，かつ生存してない場合に出撃位置を設定
					var posX = original.getMapX();
					var posY = original.getMapY();
					unit.setMapX(posX);
					unit.setMapY(posY);
				}
			}  else {
				// ユニットが見つからなかった場合は削除扱いにする
				unit.setAliveState(AliveType.ERASE);
			}
		}
		
		alias.call(this, unit);
	}

	// 敵も経験値を取得し成長させる場合の処理
	var alias2 = NormalAttackOrderBuilder._calculateExperience;
	NormalAttackOrderBuilder._calculateExperience = function(virtualActive, virtualPassive) {
		var unitSrc = this._attackInfo.unitSrc;
		var unitDest = this._attackInfo.unitDest;
		var data = StructureBuilder.buildAttackExperience();
		
		if (!this._isExperienceDisabled()) {
			// 敵/同盟ユニットの経験値処理（生きているときのみ）
			if (isSettingEnemyParam(unitSrc) && unitSrc.getUnitType() !== UnitType.PLAYER && virtualActive.hp > 0) {
				// 攻撃側の経験値処理用のデータ
				data.active = unitSrc;
				data.activeHp = virtualActive.hp;
				data.activeDamageTotal = virtualActive.damageTotal;
				data.passive = unitDest;
				data.passiveHp = virtualPassive.hp;
				data.passiveDamageTotal = virtualPassive.damageTotal;
			} else if (isSettingEnemyParam(unitDest) && unitDest.getUnitType() !== UnitType.PLAYER && virtualPassive.hp > 0) {
				// 防衛側の場合の経験値処理用のデータ
				data.active = unitDest;
				data.activeHp = virtualPassive.hp;
				data.activeDamageTotal = virtualPassive.damageTotal;
				data.passive = unitSrc;
				data.passiveHp = virtualActive.hp;
				data.passiveDamageTotal = virtualActive.damageTotal;
			}

			// data が存在する場合のみ経験値を計算
			if (data.active) {
				// 経験値の計算，成長
				var exp = ExperienceCalculator.calculateExperience(data);
				ExperienceControl.directGrowth(data.active, exp);
			}
		
			return alias2.call(this, virtualActive, virtualPassive);
		}
	}

	// 獲得経験値計算
	var alias3 = ExperienceControl.obtainExperience;
	ExperienceControl.obtainExperience = function(unit, getExp) {
		if (isSettingEnemyParam(unit) && isGrowthUnit(unit)) {
			// 敵のユニットの場合、コピー元のユニットの成長率をもとに経験値加算処理
			var growthArray;

			// 経験値加算
			if (!this._addExperience(unit, getExp)) {
				// 成長しない場合は終了
				return null;
			}

			// 成長する場合
			var srcUnit = getSrcUnit(unit);
			if (srcUnit.getUnitType() === UnitType.PLAYER) {
				growthArray = this._createGrowthArray(srcUnit);
			}
			else {
				growthArray = srcUnit.getClass().getPrototypeInfo().getGrowthArray(srcUnit.getLv());
			}

			return growthArray;
		}

		return alias3.call(this, unit, getExp);
	}
	
	// 成長
	var alias4 = ExperienceControl.directGrowth;
	ExperienceControl.directGrowth = function(unit, getExp) {
		// 敵を成長させる場合
		if (isSettingEnemyParam(unit) && isGrowthUnit(unit)) {
			// 元となるユニットの成長率を用いて経験値を計算
			var growthArray = this.obtainExperience(unit, getExp);

			if (growthArray !== null) {
				this.plusGrowth(unit, growthArray);
			}

			// 多重に経験値を取得するのを防ぐために call は呼ばずに終了
			return;
		}
		
		alias4.call(this, unit, getExp);
	}

	var alias5 = NormalAttackOrderBuilder._endVirtualAttack;
	NormalAttackOrderBuilder._endVirtualAttack = function(virtualActive, virtualPassive){
		alias5.call(this, virtualActive, virtualPassive);

		// 経験値、耐久値減少後に計算後に値のコピーを行う
		if (isSettingEnemyParam(virtualActive.unitSelf)) {
			var destUnit = getSrcUnit(virtualActive.unitSelf);

			if (destUnit !== null) {
				syncUnitData(destUnit, virtualActive.unitSelf);
			}
		}

		if (isSettingEnemyParam(virtualPassive.unitSelf)) {
			var destUnit = getSrcUnit(virtualPassive.unitSelf);

			if (destUnit !== null) {
				syncUnitData(destUnit, virtualPassive.unitSelf);
			}
		}
	}

	// 耐久値減少時の値コピー
	var alias6 = ItemControl.decreaseLimit;
	ItemControl.decreaseLimit = function(unit, item) {
		alias6.call(this, unit, item);

		// 経験値、耐久値減少後に計算後に値のコピーを行う
		if (isSettingEnemyParam(unit)) {
			var destUnit = getSrcUnit(unit);

			if (destUnit !== null) {
				syncUnitData(destUnit, unit);
			}
		}
	}

	// 他のユニットのパラメータで上書きする機能を使用するか
	isSettingEnemyParam = function(unit) {
		return unit.custom.setEnemyParamByPlayer !== undefined;
	}

	// unit を成長させるか
	isGrowthUnit = function(unit) {
		return isEnemyGrowthDefault ||
			   (typeof unit.custom.setEnemyParamByPlayer.isEnemyGrowth === 'boolean' &&
			    unit.custom.setEnemyParamByPlayer.isEnemyGrowth);
	}

	// unit を削除扱いとするか
	isEraseUnit = function(unit) {
		return notFoundSrcUnitDefault === 'erase' ||
			   (typeof unit.custom.setEnemyParamByPlayer.notFoundSrcUnit === 'string' &&
			   unit.custom.setEnemyParamByPlayer.notFoundSrcUnit === 'erase');
	}

	// 元のユニットと同時に存在することを許すか
	isAllowDoppergengar = function(unit) {
		return isAllowDopperDefault === 'erase' ||
			   (typeof unit.custom.setEnemyParamByPlayer.isAllowDopper === 'boolean' &&
			   unit.custom.setEnemyParamByPlayer.isAllowDopper === 'erase');
	}
	
	/*
	 * destUnit へコピーする元のユニットを取得
	 * 返り値はデスティネーションユニット / 見つからない場合は -1 を返す
	 */
	getSrcUnit = function(destUnit) {
		// 元のユニットが定義されていない場合は何もしない
		if (destUnit.custom.setEnemyParamByPlayer.srcUnit === undefined) {
			return null;
		}

		// 探すために必要なユニットのリストを選択
		var list;

		if (destUnit.custom.setEnemyParamByPlayer.srcUnit.unitType === 'player') {
			list = PlayerList.getMainList();
		} else if (destUnit.custom.setEnemyParamByPlayer.srcUnit.unitType === 'ally') {
			list = AllyList.getMainList();
		} else if (destUnit.custom.setEnemyParamByPlayer.srcUnit.unitType === 'enemy') {
			list = EnemyList.getMainList();
		} else if (destUnit.custom.setEnemyParamByPlayer.srcUnit.unitType === 'all') {
			list = AllUnitList.getList();
		} else {
			// デフォルトは PlayerList を参照
			list = PlayerList.getMainList();
		}

		listSize = list.getCount();

		if (typeof destUnit.custom.setEnemyParamByPlayer.srcUnit.id === 'number') {
			// ユニット id を元に検索
			unitId = destUnit.custom.setEnemyParamByPlayer.srcUnit.id;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.getBaseId() == unitId) {
					return srcUnit;
				}
			}

			return -1;
		} else if (typeof destUnit.custom.setEnemyParamByPlayer.srcUnit.name === 'string') {
			// ユニット名を元に検索
			unitName = destUnit.custom.srcUnit.name;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.getName() == unitName) {
					return srcUnit;
				}
			}

			return null;
		} else if (typeof destUnit.custom.setEnemyParamByPlayer.srcUnit.keyWord === 'string') {
			// 設定したキーワードを元に検索
			unitKeyWord = destUnit.custom.setEnemyParamByPlayer.srcUnit.keyWord;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.custom.setEnemyParamByPlayer.srcUnitKeyWord == unitKeyWord) {
					return srcUnit;
				}
			}

			return -1;
		} else if (typeof destUnit.custom.setEnemyParamByPlayer.srcUnit.pos === 'number') {
			// 出撃順を元に検索
			unitPos = destUnit.custom.setEnemyParamByPlayer.srcUnit.pos;
	
			if (unitPos < listSize) {
				return list.getData(unitPos);
			}

			return null;
		} else if (typeof destUnit.custom.setEnemyParamByPlayer.srcUnit.param === 'string') {
			// パラメータ状態を元に検索
			return null;
		}

		return null;
	}

	/*
	 * srcUnit から destUnit へ値をコピー
	 * destUnit の情報を元にコピーするかを決定する
	 *  
	 * destUnit : 値を書き込むユニット
	 * srcUnit : 値を読み込むユニット
	 */
	copyUnitData = function(destUnit, srcUnit) {
		var count = ParamGroup.getParameterCount() - 1;

		// パラメータ
		for (i = 0; i < count; i++) {
			var param = ParamGroup.getUnitValue(srcUnit, i);
			param = ParamGroup.getValidValue(destUnit, param, i); // 上限チェック
			ParamGroup.setUnitValue(destUnit, i, param);
		}

		// Item
		var itemCount = DataConfig.getMaxUnitItemCount();
		for (i = 0; i < itemCount; i++) {
			var org_item = srcUnit.getItem(i);
			if (org_item === null) {
				// アイテムがなくなった時点で終了
				break;
			}
			destUnit.clearItem(i); // 一旦アイテムを消す
			destUnit.setItem(i, root.duplicateItem(org_item)); // アイテムをコピー
		}

		// HP
		destUnit.setHp(srcUnit.getHp())
		// MAX HP を越した場合の処理がいるかも？

		// Lv
		destUnit.setLv(srcUnit.getLv());

		// 経験値
		destUnit.setExp(srcUnit.getExp());

		// クラス
		destUnit.setClass(srcUnit.getClass());

		// 名前
		destUnit.setName(srcUnit.getName());

		// 説明文
		destUnit.setDescription(srcUnit.getDescription());

		// 顔画像
		destUnit.setFaceResourceHandle(srcUnit.getFaceResourceHandle());

		// 重要度
		destUnit.setImportance(srcUnit.getImportance());

		// クラスグループ
		destUnit.setClassGroupId1(srcUnit.getClassGroupId1());
		destUnit.setClassGroupId2(srcUnit.getClassGroupId2());

		// クラスチェンジの回数
		destUnit.setClassUpCount(srcUnit.getClassUpCount());
	}

	/*
	 * srcUnit から destUnit へ値をコピー
	 * srcUnit の情報を元にコピーするかを決定する
	 * 
	 * destUnit : 値を書き込むユニット
	 * srcUnit : 値を読み込むユニット
	 */
	syncUnitData = function(destUnit, srcUnit) {
		var count = ParamGroup.getParameterCount() - 1;

		// パラメータ
		for (i = 0; i < count; i++) {
			var param = ParamGroup.getUnitValue(srcUnit, i);
			param = ParamGroup.getValidValue(destUnit, param, i); // 上限チェック
			ParamGroup.setUnitValue(destUnit, i, param);
		}

		// アイテムの情報をコピー
		var itemCount = DataConfig.getMaxUnitItemCount();
		for (i = 0; i < itemCount; i++) {
			var org_item = srcUnit.getItem(i);
			if (org_item === null) {
				// アイテムがなくなった時点で終了
				break;
			}
			destUnit.clearItem(i); // 一旦アイテムを消す
			destUnit.setItem(i, root.duplicateItem(org_item)); // アイテムをコピー
		}
		
		// HP
		destUnit.setHp(srcUnit.getHp())
		// MAX HP を越した場合の処理がいるかも？

		// Lv
		destUnit.setLv(srcUnit.getLv());

		// 経験値
		destUnit.setExp(srcUnit.getExp());
	}
})();