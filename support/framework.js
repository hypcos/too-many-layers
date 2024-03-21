var NOTATION_OFFSET = 1
var Notation = saladProduct(NOTATION_OFFSET,...sequences)
var INIT_EXPRS = [ [[],[],[1]], [[],[1]], [] ]
var getNextExpressions = (expr,upper=[Infinity],ignoreLower=NOTATION_OFFSET)=>{
   var parNotation = saladProduct(0,...sequences.slice(ignoreLower).concat(sequences.slice(0,ignoreLower)))
   var higher = upper+''==='Infinity'?upper:upper.slice(ignoreLower)
   var terms = getBetween(expr.slice(ignoreLower),higher,parNotation.FS,parNotation.compare,parNotation.isLimit,parNotation.decrement)
   if(!terms.length) return []
   var subset = [terms.shift()]
   while(terms.length){
      if(subset[0].flat().length>terms[0].flat().length) subset.unshift(terms.shift())
      else terms.shift()
   }//result [expressions from lower to higher] in the same ordering as getBetween
   return subset.map(x=>Array(ignoreLower).fill(0).map(()=>[]).concat(x)).reverse()
}
var INF = new Decimal(Infinity)
,TEN = new Decimal(10)
,TWO = new Decimal(2)
,ONE = new Decimal(1)
,HALF = new Decimal(.5)
,ZERO = new Decimal(0)
,NEGONE = new Decimal(-1)
,NEGTWO = new Decimal(-2)
/*player.L has many layerKey:layerData*/
var playerDefault = ()=>({
   /*Layers*/
   L:{}
   /*Automation*/
   ,A:[]//autobuyer
   ,a:[]//autoprestiger
   /*Playing*/
   ,t:Date.now()//last frame update at
   ,g:0//seconds since game start
   /*Options*/
   ,H:1//hotkey on=1/off=0
   ,h:[]//go-to-layerpage hotkey [0~9:layerKey,...]
   ,u:50//update interval/ms
   ,s:20//autosave interval/s
   ,o:100//offline progression speed
   ,D:5//Decimal precision
   ,d:6//sequence shorten threshold
   ,p:1//Progress statement amount
   /*Version of the Notation*/
   ,v:1
})
,player = Vue.reactive(playerDefault())
/*layers are sorted from higher to lower*/
,layerKeys = Vue.reactive([])
,reverseLayerKeys = Vue.computed(()=>layerKeys.slice(0,-1).reverse())
/**each layer is layerKey:content where content includes
   fullname: string
   things: Map[[thingKey,content],...]
   production: (dt)=>{do something;} on each tick
   initial: {thingKey:amount}
   layout: {
      colors:'cell1'~'cell14' or nothing
      P:boolean
      upgrades:[row=[entryKey,...],...],
      buyables:[row=[column=[entryKey,...],...],...],
      buyableTexts:[entryKey,...],
      challenges:[entryKey,...],
      challTexts:[entryKey,...],
      achievements:[row=[entryKey,...],...],
      achiTexts:[entryKey,...],
   }
   auto: [String/Function working-on, String autobuyer, String autoprestiger]
      Function working-on: (layerKey)=>boolean true:accept the layer as working target
   hasSublayer: boolean
   hidden: ()=>boolean
where each thing (thingKey P means points, '' ("stored" type) means total points, Uyx/Ayx means upgrade/achievement yx) has
   fullname: string
   shortname: string
   description: ()=>string
   tooltip: string or ()=>string
   type: string (upgrade, achievement, buyable, produced, challenge, computed; otherwise the number is simply stored)
   Pmode: string only for P
   Pgain: ()=>gain_amount only for P (Decimal instead of Number)
   calc: ()=>Decimal (not Number) for computed thing
   costs: [single_cost,...] for upgrade/buyable
   where each single_cost has (functions return Decimal instead of Number)
      cost:(amount)=>value
      invCost:(value)=>amount for price-based challenge
      sumcost:(amount)=>value
      invSumcost:(value)=>amount
      _cost:(amount)=>value for respec + price-based challenge
      _sumcost:(amount)=>value for respec + price-based challenge
      layer:layerKey optional
      thing:thingKey along with layer
   effect: (newamount,oldamount)=>{do something;} after buy, like a $watch callback function
   difficultyMax: Number for challenges
   challengeReject: (triggerLayer,queueDifficulty)=>boolean for challenges
   assignReject: (triggerLayer)=>boolean for challenges
   hidden: ()=>boolean*/
,layers = Vue.reactive({})
,layerDataDefault = (layerKey,layer)=>{
   var init = layer?.initial||layers[layerKey].initial
   var a={}
   var hasChallenge = false
   ;(layer?.things||getLayerThings(layerKey)).forEach((thing,thingKey)=>{
      switch(thing.type){
      case 'computed':
         break
      case 'challenge':
         a[thingKey] = {}
         hasChallenge = true
         if(!queueDifficulty[layerKey]) queueDifficulty[layerKey] = {}
         if(thing.difficultyMax){
            var queue = getChallengeInQueue(layerKey)
            if(queue[0]===thingKey) queueDifficulty[layerKey][thingKey] = queue[1]
            else if(!queueDifficulty[layerKey][thingKey]) queueDifficulty[layerKey][thingKey] = 1
         }
         break
      case 'upgrade':case 'achievement':
         a[thingKey.slice(0,-1)] = 0
         break
      default:
         a[thingKey] = 0
         thingKey==='P'&&(a[''] = 0)
      }
   })
   return hasChallenge?{
      a:Object.assign(a,init)//thingKey:amount for non-upgrade stored thing
      ,c:['',0]//[thingKey,difficulty] for queue challenge
      ,C:['',0,'']//[thingKey,difficulty,trigger layerKey] for running challenges
      ,r:0//reset count since previous reset of higher layers
      ,t:player.g//seconds since previous reset or reset of higher layers
   }:{
      a:Object.assign(a,init)
      ,r:0
      ,t:player.g
   }
}
/*each layer factory is {accept:(expr)=>boolean, output:(expr)=>{content of the layer}}*/
var layerFactories = []
,updateLayerInfo = layerKey=>{
   var expr = Notation.parse(layerKey)
   var factory = layerFactories.find(e=>e.accept(expr))
   if(!factory) return;
   layers[layerKey] = factory.output(expr)
   var dataDefault = layerDataDefault(layerKey)
   player.L[layerKey] = Object.assign(Object.assign({},dataDefault), player.L[layerKey])
   player.L[layerKey].a = Object.assign(dataDefault.a, player.L[layerKey].a)
   getLayerThings(layerKey).forEach((thing,thingKey)=>
      typeof thing.effect==='function'&& (watchers.has(layerKey+'"'+thingKey)|| watchers.set(layerKey+'"'+thingKey,Vue.watch(
         thing.type==='upgrade'||thing.type==='achievement'
         ?(()=>hasBinaryThing(layerKey,thingKey))
         :(()=>''+getThingAmount(layerKey,thingKey))
      ,thing.effect)))
   )
   !autobuyerPool.has(layerKey)&&player.A.some(x=>x[0]===layerKey)&&autobuyerPool.add(layerKey)
   !autoprestigerPool.has(layerKey)&&player.a.some(x=>x[0]===layerKey)&&autoprestigerPool.add(layerKey)
}
,addLayersAbove = (layerKey)=>{
   var idx = layerKeys.indexOf(layerKey)
   ,lowExpr = Notation.parse(layerKey)
   getNextExpressions(lowExpr, idx?Notation.parse(layerKeys[idx-1]):undefined, layers[layerKey].hasSublayer?0:undefined)
   .forEach(expr=>{
      var factory = layerFactories.find(e=>e.accept(expr))
      if(!factory) return;
      var l = Notation.invParse(expr)
      updateLayerInfo(l)
      layerKeys.splice(idx,0,l)
      applyPostNewLayer(l)
   })
}
,initSingleLayer = expr=>{
   var factory = layerFactories.find(e=>e.accept(expr))
   if(!factory) return;
   var l = Notation.invParse(expr)
   player.L[l] = layerDataDefault(l, layers[l] = factory.output(expr))
   layerKeys.push(l)
}
,initLayers = ()=>{
   layerKeys.splice(0)
   INIT_EXPRS.forEach(initSingleLayer)
}
,resumeSingleLayer = expr=>{
   var factory = layerFactories.find(e=>e.accept(expr))
   if(!factory) return;
   var l = Notation.invParse(expr)
   layers[l] = factory.output(expr)
   layerKeys.push(l)
}
,resumeLayersInfo = dataL=>{
   layerKeys.splice(0)
   Object.keys(dataL).map(Notation.parse).sort((key1,key2)=>Notation.compare(key2,key1)).forEach(resumeSingleLayer)
}
var applyWithinExtraKeeps = (extras,firing,target)=>{
   switch(({}).toString.call(extras)){
   case '[object Function]':
      return extras(firing,target)
   case '[object Array]':
      return extras.reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
   case '[object Object]':
      return Object.values(extras).reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
   case '[object Map]':
      return Array.from(extras.values()).reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
   case '[object Set]':
      return Array.from(extras).reduce((prev,x)=>prev.concat(applyWithinExtraKeeps(x,firing,target)),[])
   default:
      return []
   }
}
,applyWithinExtraActions = (extras,...args)=>{
   switch(({}).toString.call(extras)){
   case '[object Function]':
      return extras(...args)
   case '[object Array]':case '[object Map]':case '[object Set]':
      return extras.forEach(x=>applyWithinExtraActions(x,...args))
   case '[object Object]':
      return Object.values(extras).forEach(x=>applyWithinExtraActions(x,...args))
   }
}
/*those will be registered later on*/
var extraKeeps = new Map()//innermost should be (firingLayerKey,targetLayerKey)=>[thingKey,...] of keeping things
,applyExtraKeeps = (firing,target)=>applyWithinExtraKeeps(extraKeeps,firing,target)
,extraTexts = new Map()//innermost should be layerKey=>'HTML text shown on that layer'
,applyExtraTexts = (layerKey,...args)=>applyWithinExtraKeeps(extraTexts,layerKey,...args).join('<br>')
,prePrestige = new Map()//innermost should be layerKey=>{do something;}
,applyPrePrestige = (layerKey,...args)=>applyWithinExtraActions(prePrestige,layerKey,...args)
,postPrestige = new Map()
,applyPostPrestige = (layerKey,...args)=>applyWithinExtraActions(postPrestige,layerKey,...args)
,postNewLayer = new Map()//innermost should be layerKey=>{do something;}
,applyPostNewLayer = (layerKey,...args)=>applyWithinExtraActions(postNewLayer,layerKey,...args)
,preChallenge = new Map()//innermost should be (layerKey,challengeKey)=>{do something;}
,applyPreChallenge = (layerKey,challengeKey,...args)=>applyWithinExtraActions(preChallenge,layerKey,challengeKey,...args)
,postChallenge = new Map()
,applyPostChallenge = (layerKey,challengeKey,...args)=>applyWithinExtraActions(postChallenge,layerKey,challengeKey,...args)
,postBuy = new Map()//innermost should be (layerKey,thingKey,amount=1,prevAmount)=>{do something;}
,applyPostBuy = (layerKey,thingKey,amount=1,...args)=>applyWithinExtraActions(postBuy,layerKey,thingKey,amount,...args)
/*game running parameters*/
var lastSave = Date.now()
,exportBox = Vue.ref(false)
,exportContent = Vue.ref('')
,queueDifficulty = Vue.reactive({})
,tabs = Vue.reactive({
   topleft:1,
   autos:0,
   layer:'1',
})
,progressTexts = Vue.reactive([])
,updateProgressTexts = ()=>{
   var target=player.p,i=0,len
   if(target) do{
      len=layerKeys.length
      i=0
      layerKeys.slice(0,-1).some(layerKey=>{
         if(layers[layerKey].hidden?.()) return false
         var prog = getPointGain(layerKey).add(getPointTotal(layerKey))
         if(ONE.lte(prog)||ZERO.gte(prog)) return false
         progressTexts[i] = [Notation.display(Notation.parse(layerKey)),formatPercent(prog)]
         return ++i>=target
      })
   }while(layerKeys.length!==len);
   progressTexts.splice(i)
}
/*computed numbers; access a number via computed[layerKey+'"'+thingKey]; computed[layerKey+'"P'] is calculated point gain*/
var computed = Vue.reactive({})
,hasComputed = new Set()
var watchers = new Map()
/*methods*/
var delay = (f,...args)=>setTimeout(f,0,...args)
,runProduction = dt=>layerKeys.forEach(layerKey=>{
   player.L[layerKey].t += dt
   typeof layers[layerKey].production==='function'&&layers[layerKey].production(dt)
})
var gameloop = dt=>{
   player.g += dt
   hasComputed.clear()
   runProduction(dt)
   executeAutoprestigers()
   executeAutobuyers()
   updateProgressTexts()
}
var offlineTime = Vue.ref(0)
,runGame = ()=>{
   setTimeout(runGame,player.u)
   var dt = (Date.now()-player.t)*.001
   if(!(dt>=0)) return;
   player.t = Date.now()
   if(offlineTime.value){
      var ofl = Math.min(dt*Math.exp(player.o*.03+2),offlineTime.value)
      offlineTime.value -= ofl
      gameloop(dt+ofl)
   }else{
      gameloop(dt)
      if(Date.now()-lastSave>=player.s*1000){
         saveGame()
         lastSave=Date.now()
      }
   }
}