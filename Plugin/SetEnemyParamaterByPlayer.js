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
  {setEnemyParamByPlayer:true, srcUnit : {unitType : 'player', id : 5}}

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

	// 敵も経験値を取得し成長させる場合
	var alias2 = NormalAttackOrderBuilder._calculateExperience;
	NormalAttackOrderBuilder._calculateExperience = function(virtualActive, virtualPassive) {
		var unitSrc = this._attackInfo.unitSrc;
		var unitDest = this._attackInfo.unitDest;
		var data = StructureBuilder.buildAttackExperience();
		
		if (!this._isExperienceDisabled()) {
			if (isSettingEnemyParam(unitSrc) && unitSrc.getUnitType() !== UnitType.PLAYER && virtualActive.hp > 0) {
				// 攻撃をしかけたのが自軍ではなく、さらに死亡していない場合の処理
				data.active = unitSrc;
				data.activeHp = virtualActive.hp;
				data.activeDamageTotal = virtualActive.damageTotal;
				data.passive = unitDest;
				data.passiveHp = virtualPassive.hp;
				data.passiveDamageTotal = virtualPassive.damageTotal;
			} else if (isSettingEnemyParam(unitDest) && unitDest.getUnitType() !== UnitType.PLAYER && virtualPassive.hp > 0) {
				// 攻撃を受けたのが自軍ではなく、さらに死亡していない場合の処理
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

				// 元となったデータに成長を反映
				var original = getSrcUnit(data.active);

				if (typeof original !== 'number') {
					syncUnitData(original, data.active);
				}
			}
		
			return alias2.call(this, virtualActive, virtualPassive);
		}
	}

	// 敵の経験値を元となるユニットの成長率を用いて計算
	var alias3 = ExperienceControl.obtainExperience;
	ExperienceControl.obtainExperience = function(unit, getExp) {
		// 元の成長率をもとに経験値加算処理
		if (isSettingEnemyParam(unit) && isGrowthUnit(unit)) {
			var growthArray;

			// 経験値加算
			if (!this._addExperience(unit, getExp)) {
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
	
	// 敵の経験値を元となるユニットの成長率を用いて計算
	var alias4 = ExperienceControl.directGrowth;
	ExperienceControl.directGrowth = function(unit, getExp) {
		if (isSettingEnemyParam(unit) && isGrowthUnit(unit)) {
			var growthArray = this.obtainExperience(unit, getExp);

			if (growthArray !== null) {
				this.plusGrowth(unit, growthArray);
			}

			// 多重に経験値を取得するのを防ぐために call は呼ばずに終了
			return;
		}
		
		alias4.call(this, unit, getExp);
	}

	// 他のユニットのパラメータで上書きする機能を使用するか
	isSettingEnemyParam = function(unit) {
		return typeof unit.custom.setEnemyParamByPlayer === 'boolean' &&
	     	   unit.custom.setEnemyParamByPlayer;
	}

	// unit を成長させるか
	isGrowthUnit = function(unit) {
		return isEnemyGrowthDefault ||
			   (typeof unit.custom.isEnemyGrowth === 'boolean' &&
			    unit.custom.isEnemyGrowth);
	}

	// unit を削除扱いとするか
	isEraseUnit = function(unit) {
		return notFoundSrcUnitDefault === 'erase' ||
			   (typeof unit.custom.notFoundSrcUnit === 'string' &&
			   unit.custom.notFoundSrcUnit === 'erase');
	}

	// 元のユニットと同時に存在することを許すか
	isAllowDoppergengar = function(unit) {
		return isAllowDopperDefault === 'erase' ||
			   (typeof unit.custom.isAllowDopper === 'boolean' &&
			   unit.custom.isAllowDopper === 'erase');
	}
	
	/*
	 * destUnit へコピーする元のユニットを取得
	 * 返り値はデスティネーションユニット / 見つからない場合は -1 を返す
	 */
	getSrcUnit = function(destUnit) {
		//
		if (destUnit.custom.srcUnit === undefined) {
			return -1;
		}

		// 探すために必要なユニットのリストを選択
		var list;

		if (destUnit.custom.srcUnit.unitType === 'player') {
			list = PlayerList.getMainList();
		} else if (destUnit.custom.srcUnit.unitType === 'ally') {
			list = AllyList.getMainList();
		} else if (destUnit.custom.srcUnit.unitType === 'enemy') {
			list = EnemyList.getMainList();
		} else if (destUnit.custom.srcUnit.unitType === 'all') {
			list = AllUnitList.getList();
		} else {
			// デフォルトは PlayerList を参照
			list = PlayerList.getMainList();
		}

		listSize = list.getCount();

		if (typeof destUnit.custom.srcUnit.id === 'number') {
			unitId = destUnit.custom.srcUnit.id;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.getBaseId() == unitId) {
					return srcUnit;
				}
			}

			return -1;
		} else if (typeof destUnit.custom.srcUnit.name === 'string') {
			unitName = destUnit.custom.srcUnit.name;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.getName() == unitName) {
					return srcUnit;
				}
			}

			return -1;
		} else if (typeof destUnit.custom.srcUnit.keyWord === 'string') {
			unitKeyWord = destUnit.custom.srcUnit.keyWord;

			for (i = 0; i < listSize; i++) {
				var srcUnit = list.getData(i);
	
				if (srcUnit.custom.srcUnitKeyWord == unitKeyWord) {
					return srcUnit;
				}
			}

			return -1;
		} else if (typeof destUnit.custom.srcUnit.pos === 'number') {
			unitPos = destUnit.custom.srcUnit.pos;
	
			if (unitPos < listSize) {
				return list.getData(unitPos);
			}

			return -1;
		} else if (typeof destUnit.custom.srcUnit.param === 'string') {
			return -1;
		}

		return -1;
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

		// Item : なんだかエラーで落ちる？
		/*
		var itemCount = DataConfig.getMaxUnitItemCount();
		for (i = 0; i < itemCount; i++) {
			destUnit.clearItem(i);
			destUnit.setItem(i, srcUnit.getItem(i));
		}
		*/
		
		// HP
		//destUnit.setHp(srcUnit.getHp())
		// MAX HP を越した場合の処理がいるかも？

		// Lv
		destUnit.setLv(srcUnit.getLv());

		// 経験値
		destUnit.setExp(srcUnit.getExp());

		// クラス
		destUnit.setClass(srcUnit.getClass());

		// 名前
		//destUnit.setName(srcUnit.getName());

		// 説明文
		//destUnit.setDescription(srcUnit.getDescription());

		// 顔画像
		//destUnit.setFaceResourceHandle(srcUnit.getFaceResourceHandle());

		// 重要度
		//destUnit.setImportance(srcUnit.getImportance());

		// クラスグループ
		//destUnit.setClassGroupId1(srcUnit.getClassGroupId1());
		//destUnit.setClassGroupId2(srcUnit.getClassGroupId2());

		// クラスチェンジの回数
		//destUnit.setClassUpCount(srcUnit.getClassUpCount());
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

		// Item : 
		/*
		var itemCount = DataConfig.getMaxUnitItemCount();
		for (i = 0; i < itemCount; i++) {
			destUnit.clearItem(i);
			destUnit.setItem(i, srcUnit.getItem(i));
		}
		*/
		
		// HP
		//destUnit.setHp(srcUnit.getHp())
		// MAX HP を越した場合の処理がいるかも？

		// Lv
		destUnit.setLv(srcUnit.getLv());

		// 経験値
		destUnit.setExp(srcUnit.getExp());

		// クラス
		//destUnit.setClass(srcUnit.getClass());

		// 名前
		//destUnit.setName(srcUnit.getName());

		// 説明文
		//destUnit.setDescription(srcUnit.getDescription());

		// 顔画像
		//destUnit.setFaceResourceHandle(srcUnit.getFaceResourceHandle());

		// 重要度
		//destUnit.setImportance(srcUnit.getImportance());

		// クラスグループ
		//destUnit.setClassGroupId1(srcUnit.getClassGroupId1());
		//destUnit.setClassGroupId2(srcUnit.getClassGroupId2());

		// クラスチェンジの回数
		//destUnit.setClassUpCount(srcUnit.getClassUpCount());
	}
})();