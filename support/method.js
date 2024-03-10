//Getters
var getLayerThings = layerKey=>{
   var things = Object.assign({},layers[layerKey]?.things)
   applyExtraThings(things,layerKey)
   return things
}
,getThingAmount = (layerKey,thingKey)=>player.L[layerKey].a[thingKey]||0
,hasUpgrade = (layerKey,key_or_yx)=>{
   var upg = player.L[layerKey].U
   //if(!upg) return false
   if(isNaN(+key_or_yx)) key_or_yx = +(key_or_yx.slice(1))
   else key_or_yx = +key_or_yx
   return upg.includes(key_or_yx)
}
,getPoint = layerKey=>getThingAmount(layerKey,'P')
,getPointTotal = layerKey=>getThingAmount(layerKey,'T')
,getPointGain = layerKey=>{
   var P = layers[layerKey].things.P
   if(!P) return 0
   switch(P.Pmode){
      case 'normal': return P.Pgain()
      case 'static': return Decimal.sub(P.Pgain(),getPoint(layerKey)).max(0)
      case 'static respec': return Decimal.sub(P.Pgain(),getPointTotal(layerKey)).max(0)
      default: return 0
   }
}
,getBuyable = getThingAmount
,getChallengeInQueue = layerKey=>player.L[layerKey].c||['',0]//[thingKey,difficulty]
,getChallengeRunning = layerKey=>player.L[layerKey].C||['',0,'']//[thingKey,difficulty,trigger layerKey]
,getChallengeCompletion = (layerKey,thingKey,targetLayerKey)=>player.L[layerKey].a[thingKey]?.[targetLayerKey]||0
,getStored = getThingAmount
,getComputed = (layerKey,thingKey)=>{
   var calc = getLayerThings(layerKey)[thingKey]?.calc
   return typeof calc==='function'?calc():calc
}
,getSpentOn = (layerKey,thingKey)=>{
   var thing = getLayerThings(layerKey)[thingKey]
   ,amount = thing.type==='upgrade' ? hasUpgrade(layerKey,thingKey)|0 : getThingAmount(layerKey,thingKey)
   if(Decimal.dOne.gt(amount)) return 0
   if(Decimal.dTwo.gt(amount)) return thing.cost(0)
   if(typeof thing.sumcost==='function') return thing.sumcost(amount)
   for(var sum=Decimal.dZero,i=amount-1;i>=0;--i){
      sum = sum.add(thing.cost(i))
   }
   return sum
}
var canPrestige = layerKey=>Decimal.dOne.lte(getPointGain(layerKey))
   //&&!(typeof layers[layerKey].hidden==='function'?layers[layerKey].hidden():layers[layerKey].hidden)
,canBuyUpgrade = (layerKey,key_or_yx,spend_amount=Decimal.dInf)=>{
   if(typeof key_or_yx==='number') key_or_yx = 'U'+key_or_yx
   var thing = getLayerThings(layerKey)[key_or_yx]
   if(!thing||!thing.cost||hasUpgrade(layerKey,key_or_yx)) return false
   return Decimal.min(
      thing.costUnit?getThingAmount(thing.costUnit[0],thing.costUnit[1]):getPoint(layerKey)
      ,spend_amount
   ).gte(typeof thing.cost==='function'?thing.cost(0):thing.cost)
   &&!(typeof thing.hidden==='function'?thing.hidden():thing.hidden)
}
,canBuyBuyable = (layerKey,buyableKey,spend_amount=Decimal.dInf)=>{
   var thing = getLayerThings(layerKey)[buyableKey]
   if(!thing) return false
   var amount = getBuyable(layerKey,buyableKey)
   var cost
   if(thing.cost){
      cost = typeof thing.cost==='function'?thing.cost(amount):thing.cost
   }else if(typeof thing.sumcost==='function'){/*this case only for exponential or faster-growing sumcost*/
      cost = Decimal.sub(thing.sumcost(Decimal.dOne.add(amount)),thing.sumcost(amount))
   }else return false
   return Decimal.min(
      thing.costUnit?getThingAmount(thing.costUnit[0],thing.costUnit[1]):getPoint(layerKey)
      ,spend_amount
   ).gte(cost)
   &&!(typeof thing.hidden==='function'?thing.hidden():thing.hidden)
}
//Getters end

//Actually do something
var resetThing = (layerKey,thingKey)=>{
   if(getLayerThings(layerKey)[thingKey]?.type==='upgrade') return resetUpgrades(layerKey,[thingKey])
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   layer_data.a[thingKey] = 0
}
,resetPoint = layerKey=>(resetThing(layerKey,'P'),resetThing(layerKey,'T'))
,resetUpgrades = (layerKey,yx_or_keys)=>{
   var yxs = yx_or_keys.map(k=>isNaN(+k)?+(k.slice(1)):+k)
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   yxs.forEach(yx=>{
      var idx = layer_data.U.indexOf(yx)
      if(~idx) layer_data.U.splice(idx,1)
   })
}
,resetBuyable = resetThing
,resetChallengeCompletion = (layerKey,thingKey)=>{
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   layer_data.a[thingKey] = {}
}
,resetStored = resetThing
,resetProduction = (layerKey,thingKey)=>getLayerThings(layerKey)[thingKey]?.type==='produced'&&resetThing(layerKey,thingKey)
,resetLayerProduction = (layerKey,keeps=[])=>{
   var things = getLayerThings(layerKey)
   //if(!things) return;
   var a = player.L[layerKey].a
   //if(!a) return player.L[layerKey] = layerDataDefault(layerKey)
   for(var thingKey in things){
      things[thingKey].type==='produced'&&!keeps.includes(thingKey)&&(a[thingKey] = 0)
   }
}
,resetLayer = (layerKey,keeps=[])=>{
   var things = getLayerThings(layerKey)
   //if(!things) return;
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   var old_U = [],old_a = {}
   keeps.forEach(thingKey=>{
      if(!things[thingKey]) return;
      if(things[thingKey].type==='upgrade') old_U.push(+(thingKey.slice(1)))
      else old_a[thingKey] = layer_data.a[thingKey]
   })
   player.L[layerKey] = layerDataDefault(layerKey)
   player.L[layerKey].U = old_U
   Object.assign(player.L[layerKey].a,old_a)
}
,resetFrom = (layerKey,keeps=()=>[])=>{//keeps(firing,target)=>[thingKey,...]
   var idx=layerKeys.indexOf(layerKey)
   layerKeys.slice(0,idx+1).forEach(l=>resetLayerProduction(l,applyExtraKeeps(layerKey,l).concat(keeps(layerKey,l))))
   layerKeys.slice(idx+1).forEach(l=>resetLayer(l,applyExtraKeeps(layerKey,l).concat(keeps(layerKey,l))))
}
var prestige = (layerKey,...args)=>{
   player.L[layerKey].a.P = Decimal.floor(getPointGain(layerKey)).add(getPoint(layerKey))
   player.L[layerKey].a.T = Decimal.floor(getPointGain(layerKey)).add(getPointTotal(layerKey))
   ;++player.L[layerKey].a.r
   endChallenges(layerKey)
   if(args[0]==='noreset'){
      args.shift()
      applyPrePrestige(layerKey,...args)
   }else if(args[0]==='keep'){
      var newerargs = args.slice(2)
      applyPrePrestige(layerKey,...newerargs)
      resetFrom(layerKey,args[1])
      args = newerargs
   }else{
      applyPrePrestige(layerKey,...args)
      resetFrom(layerKey)
   }
   player.L[layerKey].a.t = 0
   applyPostPrestige(layerKey,...args)
   startChallenges(layerKey)
}
var buyUpgrade = (layerKey,key_or_yx,skipcheck=false,...args)=>{
   if(!skipcheck&&!canBuyUpgrade(layerKey,key_or_yx)) return;
   //if(!player.L[layerKey]) return;
   if(isNaN(+key_or_yx)) key_or_yx = +(key_or_yx.slice(1))
   else key_or_yx = +key_or_yx
   player.L[layerKey].U.push(key_or_yx)
   //spend the cost
   key_or_yx = 'U'+key_or_yx
   var thing = getLayerThings(layerKey)[key_or_yx]
   if(thing.costUnit){
      player.L[thing.costUnit[0]].a[thing.costUnit[1]] = Decimal.sub(
         getThingAmount(thing.costUnit[0],thing.costUnit[1])
         ,typeof thing.cost==='function'?thing.cost(0):thing.cost
      )
   }else{
      player.L[layerKey].a.P = Decimal.sub(getPoint(layerKey), typeof thing.cost==='function'?thing.cost(0):thing.cost)
   }
   applyPostBuy(layerKey,key_or_yx,...args)
}
,buyBuyable = (layerKey,buyableKey,skipcheck=false,...args)=>{
   if(!skipcheck&&!canBuyBuyable(layerKey,buyableKey)) return;
   //if(!player.L[layerKey]) return;
   var amount = getBuyable(layerKey,buyableKey)
   player.L[layerKey].a[buyableKey] = Decimal.dOne.add(amount)
   //spend the cost
   var thing = getLayerThings(layerKey)[buyableKey]
   var cost
   if(thing.cost){
      cost = typeof thing.cost==='function'?thing.cost(amount):thing.cost
   }else if(typeof thing.sumcost==='function'){/*this case only for exponential or faster-growing sumcost*/
      cost = Decimal.sub(thing.sumcost(Decimal.dOne.add(amount)),thing.sumcost(amount))
   }else return;
   if(thing.costUnit){
      player.L[thing.costUnit[0]].a[thing.costUnit[1]] = Decimal.sub(getThingAmount(thing.costUnit[0],thing.costUnit[1]),cost)
   }else{
      player.L[layerKey].a.P = Decimal.sub(getPoint(layerKey),cost)
   }
   applyPostBuy(layerKey,buyableKey,...args)
}
,buymaxBuyable = (layerKey,buyableKey,spend_amount=Decimal.dInf,...args)=>{
   var thing = getLayerThings(layerKey)[buyableKey]
   if(!thing||!thing.cost||!canBuyBuyable(layerKey,buyableKey,spend_amount)) return;
   if(!(thing.invSumcost&&thing.sumcost)) return buyBuyable(layerKey,buyableKey,true)
   var had = getBuyable(layerKey,buyableKey)
   ,already_spent = thing.sumcost(had)
   ,total_spent = Decimal.min(
      thing.costUnit?getThingAmount(thing.costUnit[0],thing.costUnit[1]):getPoint(layerKey)
      ,spend_amount
   ).add(already_spent)
   ,target = Decimal.floor(thing.invSumcost(total_spent)).max(had)
   ,actual_cost = Decimal.sub(thing.sumcost(target),already_spent)
   //gain the buyable
   player.L[layerKey].a[buyableKey] = target
   //spend the cost
   if(thing.costUnit){
      player.L[thing.costUnit[0]].a[thing.costUnit[1]] = Decimal.sub(
         getThingAmount(thing.costUnit[0],thing.costUnit[1])
         ,actual_cost
      )
   }else{
      player.L[layerKey].a.P = Decimal.sub(getPoint(layerKey),actual_cost)
   }
   applyPostBuy(layerKey,buyableKey,target.sub(had),...args)
}
var respecLayer = (layerKey,pointsOnly=false)=>{
   var things = getLayerThings(layerKey)
   ,keeps=[]
   //if(!things||!player.L[layerKey]) return;
   for(var thingKey in things){
      var thing = things[thingKey]
      if(thing.costUnit){
         if(pointsOnly){
            keeps.includes(thingKey)||keeps.push(thingKey)
            continue
         }
         if(!player.L[thing.costUnit[0]]?.a[thing.costUnit[1]]) continue
         player.L[thing.costUnit[0]].a[thing.costUnit[1]] =
            Decimal.add(getSpentOn(layerKey,thingKey,true),getThingAmount(thing.costUnit[0],thing.costUnit[1]))
         if(thing.costUnit[0]===layerKey)
            keeps.includes(thing.costUnit[1])||keeps.push(thing.costUnit[1])
      }else{
         player.L[layerKey].a.P = Decimal.add(getSpentOn(layerKey,thingKey,true),getPoint(layerKey))
         keeps.includes('P')||keeps.push('P')
      }
   }
   resetLayer(layerKey,keeps)
}
var startLayerChallenge = (layerKey,trigger,...args)=>{
   var queue = getChallengeInQueue(layerKey)
   if(!queue[0]) return;
   if(getChallengeRunning(layerKey)[0]) return;
   player.L[layerKey].C = queue.concat(trigger)
   player.L[layerKey].c = ['',0]
   if(getLayerThings(layerKey)[queue[0]].challengeReject?.(trigger)) return;
   applyPreChallenge(layerKey,queue[0],...args)
}
,startChallenges = (trigger,...args)=>layerKeys.slice().reverse().forEach(layerKey=>startLayerChallenge(layerKey,trigger,...args))
,assignLayerChallenge = (layerKey,trigger)=>{
   var running = getChallengeRunning(layerKey)
   if(!running[0]) return;
   getChallengeCompletion(layerKey,running[0],trigger) < running[1] &&
   (player.L[layerKey].a[running[0]][trigger] = running[1])
}
,assignChallenges = trigger=>layerKeys.forEach(layerKey=>assignLayerChallenge(layerKey,trigger))
,endLayerChallenge = (layerKey,trigger,forced=false,...args)=>{
   var running = getChallengeRunning(layerKey)
   if(!running[0]) return;
   if(!forced&&layerKeys.indexOf(trigger)>layerKeys.indexOf(running[2])) return;
   applyPostChallenge(layerKey,running[0],...args)
   getChallengeInQueue(layerKey)[0] || (player.L[layerKey].c = running.slice(0,2))
   player.L[layerKey].C = ['',0,'']
}
,endChallenges = (trigger,...args)=>layerKeys.forEach(layerKey=>endLayerChallenge(layerKey,trigger,...args))