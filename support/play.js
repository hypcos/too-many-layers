var root,game
,currentLayer = Vue.computed(()=>tabs.layer)
,currentLayerLayout = Vue.computed(()=>layers[currentLayer.value].layout||{})
,currentLayerThings = Vue.computed(()=>Object.fromEntries(getLayerThings(currentLayer.value)))
,currentLayerP = Vue.computed(()=>' '+
   (currentLayerThings.value.P.fullname||Notation.display(Notation.parse(currentLayer.value))+' points')+
   (typeof currentLayerThings.value.P.description==='function'?
   currentLayerThings.value.P.description():
   currentLayerThings.value.P.description)
)
,clickChallenge = (btn)=>{
   var old_c = player.L[currentLayer.value].c
   if(old_c[0]===btn) player.L[currentLayer.value].c = ['',0]
   else player.L[currentLayer.value].c=[btn,currentLayerThings.value[btn].difficultyMax?queueDifficulty[currentLayer.value][btn]:1]
}
hardReset(true)
game = Vue.createApp({setup(){return{
   currentLayer,
   currentLayerLayout,
   currentLayerThings,
   currentLayerP,
   clickChallenge,
   player,
   layerKeys,
   layers,
   reverseLayerKeys,
   exportBox,
   exportContent,
   queueDifficulty,
   tabs,
   progressTexts,
   applyExtraTexts,
   delay,
   offlineTime,
   getLayerThings,
   getThingAmount,
   hasBinaryThing,
   getPoint,
   getPointTotal,
   getPointGain,
   getChallengeInQueue,
   getChallengeRunning,
   getChallengeCompletion,
   getComputed,
   canPrestige,
   canBuyUpgrade,
   canBuyBuyable,
   prestige,
   buyUpgrade,
   buyBuyable,
   buymaxBuyable,
   endLayerChallenge,
   getCostText,
   getLayerFullname,
   getLayerShortname,
   getThingFullname,
   getThingShortname,
   format,
   formatFloor,
   formatPercent,
   canShowPercent,
   hardReset,
   saveGame,
   exportGame,
   importGame,
   hasAutobuyer,
   hasAutoprestiger,
   autobuyerSelected,
   autobuyerSelectIndex,
   autobuyerMove,
   abTargetLayerText,
   abCurrentWorking,
   abThingPool,
   abThingPoolSelected,
   autoprestigerSelected,
   autoprestigerSelectIndex,
   autoprestigerMove,
   apTargetLayerText,
   apFormulaLRR,
   applyLogText,
   apFormulaInputs,
   update_apInputs,
   invUpdate_apInputs,
}}})
root = game.mount('#game')
loadGame()
window.addEventListener('keydown',e=>{
   if(!player.H) return;
   if(e.ctrlKey||e.altKey||e.metaKey) return;
   var k=e.key
   if(e.shiftKey){
      if(tabs.topleft!==3) return;
      switch(k){
      case ')': return player.h[0] = currentLayer.value
      case '!': return player.h[1] = currentLayer.value
      case '@': return player.h[2] = currentLayer.value
      case '#': return player.h[3] = currentLayer.value
      case '$': return player.h[4] = currentLayer.value
      case '%': return player.h[5] = currentLayer.value
      case '^': return player.h[6] = currentLayer.value
      case '&': return player.h[7] = currentLayer.value
      case '*': return player.h[8] = currentLayer.value
      case '(': return player.h[9] = currentLayer.value
      }
   }else{
      if(k.length===1&&(+k)+''===k){
         var layerKey = player.h[+k]
         if(!layerKey||layers[layerKey].hidden?.()) return;
         tabs.layer=layerKey
         tabs.topleft=3
         return;
      }
      switch(k){
      case ' ':case 'Spacebar':
         e.preventDefault()
         return tabs.topleft===3&&canPrestige(currentLayer.value)&&delay(prestige,currentLayer.value)
      case 'b':case 'B':
         return tabs.topleft===3&&delay(buymaxLayer,currentLayer.value)
      case 'n':case 'N':
         return delay(buymaxBuyable,'','G')
      case 'm':case 'M':
         return delay(()=>layerKeys.forEach(buymaxLayer))
      case 'a':case 'A':
         return player.A.forEach(item=>item[1]=+!item[1])
      case 'r':case 'R':
         return player.a.forEach(item=>item[1]=+!item[1])
      }
   }
})
document.getElementById('game').style.minHeight=(window.innerHeight-7)+'px'
document.body.removeChild(document.getElementById('loading'))
runGame()