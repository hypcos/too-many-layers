Notation = saladProduct(1,...sequences)
var getNextExpressions = (expr,upper=[Infinity],ignoreLower=0)=>{
   var higher = upper+''==='Infinity'?upper:upper.slice(ignoreLower)
   ,terms = getBetween(expr.slice(ignoreLower),higher,Notation.FS,Notation.compare,Notation.isLimit,Notation.decrement)
   if(!terms.length) return []
   var subset = [terms.shift()]
   while(terms.length){
      if(subset[0].flat().length>terms[0].flat().length) subset.unshift(terms.shift())
      else terms.shift()
   }//result [expressions from higher to lower]
   return subset.map(x=>Array(ignoreLower).fill(0).map(()=>[]).concat(x))
}
var player = {}
/*player.L has many layerKey:layerData*/
,playerDefault = ()=>({
   /*Layers*/
   L:{}
   /*Automation*/
   ,A:[]
   /*Playing*/
   ,t:Date.now()//last frame update at
   ,g:Date.now()//game since
   /*Options*/
   ,ui:50//update interval/ms
   ,si:10000//autosave interval/ms
   ,o:100//offline progression speed
   ,D:5//Decimal precision
   ,p:1//Progress statement amount
   ,h:{}//hotkey {lettername:layerKey,...}
   /*Version of the Notation*/
   ,v:1
})
/*layers are sorted from higher to lower*/
,layerKeys = []
/*each layer is layerKey:content where content includes
   fullname: string
   things: {thingKey:content,...}
   initial: ()=>{thingKey:amount}
   hidden: ()=>boolean
where each thing (thingKey P means points, T ("stored" type) means total points, Uyx means upgrade yx) has
   fullname: string
   tooltip: string
   type: string (upgrade, buyable, produced, challenge; stored means other number should be stored; otherwise computed)
   Pmode: string only for P
   Pgain: ()=>gain_amount only for P
   calc: ()=>number for computed thing
   cost: (amount)=>cost_number for upgrade&buyable
   costUnit: [layerKey,thingKey]
   sumcost: (amount)=>total cost number for buyable
   invSumcost: (cost)=>canbuy amount for buyable
   production: (dt)=>{do something;}
   challengeReject: (triggerLayer)=>boolean for challenges
   hidden: ()=>boolean*/
,layers = {}
,layerDataDefault = (layerKey,layer)=>{
   var things = layer?.things||getLayerThings(layerKey)
   ,init = layer?.initial||layers[layerKey].initial
   ,a={}
   applyExtraThings(things,layerKey)
   for(var thingKey in things){
      switch(things[thingKey].type){
         case 'challenge':
            a[thingKey] = {}
            break
         case 'buyable':
         case 'produced':
         case 'stored':
            a[thingKey] = 0
            break
         default: thingKey==='P'&&(a.P = 0, a.T = 0)
      }
   }
   return {
      a:Object.assign(a,typeof init==='function'&&init())//thingKey:amount for non-upgrade stored thing
      ,U:[]//yx of upgrades (Uyx) player have
      ,c:['',0]//[thingKey,difficulty] for queue challenge
      ,C:['',0,'']//[thingKey,difficulty,trigger layerKey] for running challenges
      ,r:0//reset count since previous reset of higher layers
      ,t:0//seconds since previous reset or reset of higher layers
   }
}
,addLayer = (layerKey,content)=>{
   layers[layerKey] = content
   player.L[layerKey] = layerDataDefault(layerKey,content)
   //Required: layerKeys.splice( find the right place ,0,layerKey)
}
/*computed numbers; access a number via computed[layerKey][thingKey]; computed[layerKey].P is calculated point gain*/
,computed = {}
/*those will be registered later on*/
,extraThings = []//innermost should be layerKey=>{thingKey:content,...} which can be Object.assign into layer.things
,applyWithinExtraThings = (extras,target_object,layerKey)=>{
   switch(({}).toString.call(extras)){
      case '[object Function]':
         return Object.assign(target_object,extras(layerKey))
      case '[object Array]':
         return extras.forEach(x=>applyWithinExtraThings(x,target_object,layerKey))
      case '[object Object]':
         return Object.values(extras).forEach(x=>applyWithinExtraThings(x,target_object,layerKey))
      default:
         return {}
   }
}
,applyExtraThings = (target_object,layerKey)=>{
   applyWithinExtraThings(extraThings,target_object,layerKey)
   return target_object
}
,extraKeeps = []//innermost should be (firingLayerKey,targetLayerKey)=>[thingKey,...] of keeping things
,applyWithinExtraKeeps = (extras,firing,target)=>{
   switch(({}).toString.call(extras)){
      case '[object Function]':
         return extras(firing,target)
      case '[object Array]':
         return extras.reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
      case '[object Object]':
         return Object.values(extras).reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
      default:
         return []
   }
}
,applyExtraKeeps = (firing,target)=>applyWithinExtraKeeps(extraKeeps,firing,target)
/*and apply whenever certain action happens*/
,applyWithinExtraActions = (extras,...args)=>{
   switch(({}).toString.call(extras)){
      case '[object Function]':
         return extras(...args)
      case '[object Array]':
         return extras.forEach(x=>applyWithinExtraActions(x,...args))
      case '[object Object]':
         return Object.values(extras).forEach(x=>applyWithinExtraActions(x,...args))
   }
}
,prePrestige = []//innermost should be layerKey=>{do something;}
,applyPrePrestige = (layerKey,...args)=>applyWithinExtraActions(prePrestige,layerKey,...args)
,postPrestige = []
,applyPostPrestige = (layerKey,...args)=>applyWithinExtraActions(postPrestige,layerKey,...args)
,postNewLayer = []//innermost should be layerKey=>{do something;}
,applyPostNewLayer = (layerKey,...args)=>applyWithinExtraActions(postNewLayer,layerKey,...args)
,preChallenge = []//innermost should be (layerKey,challengeKey)=>{do something;}
,applyPreChallenge = (layerKey,challengeKey,...args)=>applyWithinExtraActions(preChallenge,layerKey,challengeKey,...args)
,postChallenge = []
,applyPostChallenge = (layerKey,challengeKey,...args)=>applyWithinExtraActions(postChallenge,layerKey,challengeKey,...args)
,postBuy = []//innermost should be (layerKey,thingKey,amount=1)=>{do something;}
,applyPostBuy = (layerKey,thingKey,amount=1,...args)=>applyWithinExtraActions(postBuy,layerKey,thingKey,amount,...args)
/*game running parameters*/
,lastSave = Date.now()
,tabs = {topleft:1}
/*methods*/
,delay = (f,...args)=>setTimeout(f,0,...args)
,runLayerProduction = (layerKey,dt)=>{
   player.L[layerKey].t += dt
   var things = getLayerThings(layerKey)
   for(var thingKey in things){
      if(typeof things[thingKey].production!=='function') continue
      if(things[thingKey].type==='upgrade'&&!hasUpgrade(layerKey,thingKey)) continue
      things[thingKey].production(dt)
   }
}
,runProduction = dt=>layerKeys.forEach(layerKey=>runLayerProduction(layerKey,dt))
,updatePointGain = ()=>layerKeys.slice().reverse().forEach(layerKey=>{
   var layer_computed = computed[layerKey]
   if(!layer_computed) layer_computed = computed[layerKey] = {}
   var previous_is_low = Decimal.dOne.gt(layer_computed.P)
   ,previous_is_LOW = previous_is_low&&Decimal.add(getPointTotal(layerKey),layer_computed.P).lt(1)
   layer_computed.P = getPointGain(layerKey)
   previous_is_low&&Decimal.dOne.lte(layer_computed.P)&&assignChallenges(layerKey)
   if(!(previous_is_LOW&&Decimal.add(getPointTotal(layerKey),layer_computed.P).gte(1))) return;
   //Required: if(the layer+1 already exist) return;
   needUpdateLayers = true
})
,updateLayerComputed = layerKey=>{
   var things = getLayerThings(layerKey)
   var layer_computed = computed[layerKey]
   if(!layer_computed) layer_computed = computed[layerKey] = {}
   for(var thingKey in things){
      if(thingKey==='P'||things[thingKey].type) continue
      var calc = things[thingKey].calc
      layer_computed[thingKey] = typeof calc==='function'?calc():calc
   }
}
,updateComputed = ()=>layerKeys.forEach(updateLayerComputed)
var needUpdateLayers = false
,gameloop = dt=>{
   updateComputed()
   runProduction(dt)
   updateComputed()
   updatePointGain()
   if(needUpdateLayers){
      //Required: update layers
      needUpdateLayers = false
   }
   //Required: do some automation
   if(Date.now()-lastSave>=player.si){
      //Required: save()
      lastSave=Date.now()
   }
}