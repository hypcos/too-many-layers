var resetRunningParameters = ()=>{
   autobuyerPool.clear()
   autoprestigerPool.clear()
   extraKeeps.clear()
   extraTexts.clear()
   prePrestige.clear()
   postPrestige.clear()
   postNewLayer.clear()
   preChallenge.clear()
   postChallenge.clear()
   postBuy.clear()
   tabs.layer='1'
   autobuyerSelected.value=[]
   autobuyerSelectIndex.value=-1
   abThingPoolSelected.value=[]
   autoprestigerSelected.value=[]
   autoprestigerSelectIndex.value=-1
}
,hardReset = (skipcheck=false)=>{
   if(!(skipcheck||confirm(
      'Unlike other resets, you will lose all the progress WITHOUT ANY BONUS OR REWARD.\nDo you really want a FULL reset?'
   ))) return;
   resetRunningParameters()
   Object.assign(player,playerDefault())
   initLayers()
   layerKeys.forEach(updateLayerInfo)
}
,saveGame = ()=>{
   localStorage.setItem('TML',LZString.compress(JSON.stringify(player)))
}
,loadGame = ()=>{
   var data
   try{
      data = JSON.parse(LZString.decompress(localStorage.getItem('TML')))
   }catch(e){return;}
   if(!data) return;
   var milliseconds = Date.now()-data.t
   if(!(milliseconds>=0)) return;
   resetRunningParameters()
   resumeLayersInfo(data.L)
   Object.assign(player,data)
   layerKeys.forEach(updateLayerInfo)
   offlineTime.value = milliseconds*.001
}
,exportGame = ()=>{
   exportContent.value = LZString.compressToBase64(JSON.stringify(player))
   exportBox.value = true
}
,importGame = ()=>{
   var data
   try{
      data = JSON.parse(LZString.decompressFromBase64(exportContent.value))
   }catch(e){return;}
   if(!data) return;
   var milliseconds = Date.now()-data.t
   if(!(milliseconds>=0)) return;
   resetRunningParameters()
   resumeLayersInfo(data.L)
   Object.assign(player,data)
   layerKeys.forEach(updateLayerInfo)
   offlineTime.value = milliseconds*.001
   exportBox.value = false
}