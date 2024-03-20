//get/set
var getLayerThings = layerKey=>layers[layerKey]?.things||new Map()
,getThingAmount = (layerKey,thingKey)=>player.L[layerKey]?.a[thingKey]||0
,setThingAmount = (layerKey,thingKey,value,skipcheck=false)=>{
   var layer_data = player.L[layerKey]
   if(!skipcheck&&!layer_data) layer_data = player.L[layerKey] = layerDataDefault(layerKey)
   layer_data.a[thingKey] = value
}
,hasBinaryThing = (layerKey,thingKey)=>getThingAmount(layerKey,thingKey.slice(0,-1))&(1<<parseInt(thingKey.slice(-1),32))
,setBinaryThing = (layerKey,thingKey,value,skipcheck=false)=>{
   var layer_data = player.L[layerKey]
   if(!skipcheck&&!layer_data) layer_data = player.L[layerKey] = layerDataDefault(layerKey)
   value? (layer_data.a[thingKey.slice(0,-1)] |= 1<<parseInt(thingKey.slice(-1),32))
   : (layer_data.a[thingKey.slice(0,-1)] &= ~(1<<parseInt(thingKey.slice(-1),32)))
}
,getPoint = layerKey=>getThingAmount(layerKey,'P')
,getPointTotal = layerKey=>getThingAmount(layerKey,'')
,getPointGain = layerKey=>{
   var key=layerKey+'"P'
   if(hasComputed.has(key)) return computed[key]||ZERO
   else{
      hasComputed.add(key)
      var P = layers[layerKey]?.things.get('P')
      if(!P) return ZERO
      var prev = computed[key]
      switch(P.Pmode){
      case 'normal':
         computed[key] = P.Pgain()
         break
      case 'static':
         computed[key] = P.Pgain().sub(getPoint(layerKey)).max(ZERO)
         break
      case 'static respec':
         computed[key] = P.Pgain().sub(getPointTotal(layerKey)).max(ZERO)
         break
      default: return ZERO
      }
      if(ONE.gt(prev)){
         ONE.lte(computed[key])&&assignChallenges(layerKey)
         Decimal.add(getPointTotal(layerKey),prev).lt(ONE)&&
         Decimal.add(getPointTotal(layerKey),computed[key]).gte(ONE)&&
         addLayersAbove(layerKey)
      }
      return computed[key]
   }
}
,getBuyable = getThingAmount
,getProduced = getThingAmount
,hasUpgrade = hasBinaryThing//so one upgrade/achievement row can have at most 32 items
,hasAchievement = hasBinaryThing
,getChallengeInQueue = layerKey=>player.L[layerKey]?.c||['',0]//[thingKey,difficulty]
,getChallengeRunning = layerKey=>player.L[layerKey]?.C||['',0,'']//[thingKey,difficulty,trigger layerKey]
,getChallengeDifficulty = (layerKey,thingKey)=>{
   var C = getChallengeRunning(layerKey)
   return C[0]===thingKey?C[1]:0
}
,getChallengeCompletion = (layerKey,thingKey,targetLayerKey)=>player.L[layerKey]?.a[thingKey]?.[targetLayerKey]||0
,getComputed = (layerKey,thingKey)=>{
   var key=layerKey+'"'+thingKey
   if(hasComputed.has(key)) return computed[key]||ONE
   else{
      hasComputed.add(key)
      var calc = getLayerThings(layerKey).get(thingKey)?.calc
      return computed[key] = typeof calc==='function'?calc():calc
   }
}
,getSpentOn = (layerKey,thingKey)=>{
   var thing = getLayerThings(layerKey).get(thingKey)
   if(!thing.costs) return []
   var amount = thing.type==='upgrade' ? Math.sign(hasUpgrade(layerKey,thingKey)) : getBuyable(layerKey,thingKey)
   if(ONE.gt(amount)) return []
   return thing.costs.map(single=>{
      if(single._sumcost) return single._sumcost(amount)
      if(!single._cost) return ZERO
      for(var sum=ZERO,i=+amount;--i>=0;) sum = sum.add(single._cost(i))
      return sum
   })
}
var canPrestige = layerKey=>ONE.lte(getPointGain(layerKey))
   //&&!layers[layerKey].hidden?.()
,canBuyUpgrade = (layerKey,thingKey,spend_amount=INF)=>{
   var thing = getLayerThings(layerKey).get(thingKey)
   if(!thing||hasUpgrade(layerKey,thingKey)) return false
   if(!thing.costs) return false
   return thing.costs.every((single)=>typeof single.layer==='string'&&!(single.layer===layerKey&&single.thing==='P')
   ?Decimal.gte(getThingAmount(single.layer,single.thing),single.cost(ZERO))
   :Decimal.min(getPoint(layerKey),spend_amount).gte(single.cost(ZERO)))
   &&!thing.hidden?.()
}
,canBuyBuyable = (layerKey,buyableKey,spend_amount=INF)=>{
   var thing = getLayerThings(layerKey).get(buyableKey)
   if(!thing) return false
   if(!thing.costs) return false
   var amount = getBuyable(layerKey,buyableKey)
   return thing.costs.every((single)=>typeof single.layer==='string'&&!(single.layer===layerKey&&single.thing==='P')
   ?Decimal.gte(getThingAmount(single.layer,single.thing),single.cost(amount))
   :Decimal.min(getPoint(layerKey),spend_amount).gte(single.cost(amount)))
   &&!thing.hidden?.()
}
//get/set end

//Actually do something
var resetThing = (layerKey,thingKey)=>{
   var type = getLayerThings(layerKey).get(thingKey)?.type
   if(type==='upgrade'||type==='achievement') return resetBinaryThing(layerKey,thingKey)
   setThingAmount(layerKey,thingKey,0,true)
}
,resetBinaryThing = (layerKey,thingKey)=>setBinaryThing(layerKey,thingKey,0,true)
,resetPoint = layerKey=>(resetThing(layerKey,'P'),resetThing(layerKey,''))
,resetChallengeCompletion = (layerKey,thingKey)=>{
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   layer_data.a[thingKey] = {}
}
,resetProduction = (layerKey,thingKey)=>getLayerThings(layerKey).get(thingKey)?.type==='produced'&&setThingAmount(layerKey,thingKey,0,true)
,resetLayerProduction = (layerKey,keeps=[])=>{
   var things = getLayerThings(layerKey)
   //if(!things) return;
   var a = player.L[layerKey].a
   //if(!a) return player.L[layerKey] = layerDataDefault(layerKey)
   var keep = new Set(keeps)
   things.forEach((thing,key)=>thing.type==='produced'&&!keep.has(key)&&(a[key] = 0))
}
,resetLayer = (layerKey,keeps=[])=>{
   var things = getLayerThings(layerKey)
   //if(!things) return;
   var layer_data = player.L[layerKey]
   //if(!layer_data) return player.L[layerKey] = layerDataDefault(layerKey)
   var old_a = {}
   keeps.forEach(thingKey=>{
      if(!things.has(thingKey)) return;
      var type = things.get(thingKey).type
      if(type==='upgrade'||type==='achievement')
         old_a[thingKey.slice(0,-1)] |= hasBinaryThing(layerKey,thingKey)
      else old_a[thingKey] = layer_data.a[thingKey]
   })
   player.L[layerKey] = layerDataDefault(layerKey)
   player.L[layerKey].t = 0
   Object.assign(player.L[layerKey].a,old_a)
}
,resetFrom = (layerKey,keeps=()=>[])=>{//keeps(firing,target)=>[thingKey,...]
   var idx=layerKeys.indexOf(layerKey)
   layerKeys.slice(0,idx+1).forEach(l=>resetLayerProduction(l,applyExtraKeeps(layerKey,l).concat(keeps(layerKey,l))))
   layerKeys.slice(idx+1).forEach(l=>resetLayer(l,applyExtraKeeps(layerKey,l).concat(keeps(layerKey,l))))
}
var prestige = (layerKey,param,keeps)=>{
   applyPrePrestige(layerKey)
   if(param!=='nogain'){
      setThingAmount(layerKey,'P',getPointGain(layerKey).floor().add(getPoint(layerKey)),true)
      setThingAmount(layerKey,'',getPointGain(layerKey).floor().add(getPointTotal(layerKey)),true)
   }
   param==='noreset'||resetFrom(layerKey,keeps)
   ++player.L[layerKey].r
   player.L[layerKey].t = 0
   applyPostPrestige(layerKey)
   startChallenges(layerKey)
}
var buyUpgrade = (layerKey,thingKey,skipcheck=false)=>{
   if(!skipcheck&&!canBuyUpgrade(layerKey,thingKey)) return;
   //if(!player.L[layerKey]) return;
   setBinaryThing(layerKey,thingKey,1,skipcheck)
   //spend the cost
   getLayerThings(layerKey).get(thingKey).costs.forEach(single=>{
      if(typeof single.layer==='string') setThingAmount(single.layer,single.thing,
         Decimal.sub(getThingAmount(single.layer,single.thing),single.cost(ZERO)).max(ZERO))
      else setThingAmount(layerKey,'P',Decimal.sub(getPoint(layerKey),single.cost(ZERO)).max(ZERO))
   })
   applyPostBuy(layerKey,thingKey,ONE,ZERO)
}
,buyBuyable = (layerKey,thingKey,skipcheck=false)=>{
   if(!skipcheck&&!canBuyBuyable(layerKey,thingKey)) return;
   //if(!player.L[layerKey]) return;
   var amount = getBuyable(layerKey,thingKey)
   setThingAmount(layerKey,thingKey,ONE.add(amount),skipcheck)
   //spend the cost
   getLayerThings(layerKey).get(thingKey).costs.forEach(single=>{
      if(typeof single.layer==='string') setThingAmount(single.layer,single.thing,
         Decimal.sub(getThingAmount(single.layer,single.thing),single.cost(amount)).max(ZERO))
      else setThingAmount(layerKey,'P',Decimal.sub(getPoint(layerKey),single.cost(amount)).max(ZERO))
   })
   applyPostBuy(layerKey,thingKey,ONE,amount)
}
,buymaxBuyable = (layerKey,thingKey,spend_amount=INF)=>{
   var costs = getLayerThings(layerKey).get(thingKey)?.costs
   if(!costs||!canBuyBuyable(layerKey,thingKey,spend_amount)) return;
   if(!costs.every(single=>single.sumcost&&single.invSumcost)) return buyBuyable(layerKey,thingKey,true)
   var had = getBuyable(layerKey,thingKey)
   ,target = costs.map((single)=>{
      var already_spent = single.sumcost(had)
      ,total_spent = typeof single.layer==='string'&&!(single.layer===layerKey&&single.thing==='P')
      ?Decimal.add(getThingAmount(single.layer,single.thing),already_spent)
      :Decimal.min(getPoint(layerKey),spend_amount).add(already_spent)
      return single.invSumcost(total_spent).floor()
   }).reduce(Decimal.min,INF).max(had)
   //gain the buyable
   setThingAmount(layerKey,thingKey,target,true)
   //spend the cost
   costs.forEach(single=>{
      var spend = single.sumcost(target).sub(single.sumcost(had))
      if(typeof single.layer==='string') setThingAmount(single.layer,single.thing,
         Decimal.sub(getThingAmount(single.layer,single.thing),spend).max(ZERO),true)
      else setThingAmount(layerKey,'P',Decimal.sub(getPoint(layerKey),spend).max(ZERO),true)
   })
   applyPostBuy(layerKey,thingKey,target.sub(had),had)
}
var buymaxLayer = layerKey=>getLayerThings(layerKey).forEach((thing,thingKey)=>{
   switch(thing.type){
   case 'upgrade':
      buyUpgrade(layerKey,thingKey)
      break
   case 'buyable':
      buymaxBuyable(layerKey,thingKey)
      break
   }
})
var respec = (layerKey,thingKeyList)=>{
   var things = getLayerThings(layerKey)
   //if(!things||!player.L[layerKey]) return;
   if(!thingKeyList){
      thingKeyList = []
      things.forEach((thing,thingKey)=>thing.costs&&thingKeyList.push(thingKey))
   }
   thingKeyList.forEach(thingKey=>{
      var spent = getSpentOn(layerKey,thingKey)
      things.get(thingKey).costs.forEach((single,i)=>{
         if(typeof single.layer==='string'){
            setThingAmount(single.layer,single.thing,Decimal.add(getThingAmount(single.layer,single.thing),spent[i]))
         }else{
            setThingAmount(layerKey,'P',Decimal.add(getPoint(layerKey),spent[i]),true)
         }
         things.get(thingKey).type==='upgrade'?setBinaryThing(layerKey,thingKey,0):setThingAmount(layerKey,thingKey,0)
      })
   })
   prestige(layerKey,'nogain')
}
var startLayerChallenge = (layerKey,trigger)=>{
   var queue = getChallengeInQueue(layerKey)
   if(!queue[0]) return;
   if(getChallengeRunning(layerKey)[0]) return;
   if(getLayerThings(layerKey).get(queue[0]).challengeReject?.(trigger,queue[1])) return;
   player.L[layerKey].C = queue.concat(trigger)
   player.L[layerKey].c = ['',0]
   applyPreChallenge(layerKey,queue[0])
}
,startChallenges = (trigger)=>layerKeys.forEach(layerKey=>startLayerChallenge(layerKey,trigger))
,assignLayerChallenge = (layerKey,trigger)=>{
   var running = getChallengeRunning(layerKey)
   if(!running[0]) return;
   if(getLayerThings(layerKey).get(running[0]).assignReject?.(trigger)) return;
   getChallengeCompletion(layerKey,running[0],trigger) < running[1] &&
   Notation.compare(Notation.parse(trigger),Notation.parse(running[2]))<=0 &&
   (player.L[layerKey].a[running[0]][trigger] = running[1])
   if(Notation.compare(Notation.parse(trigger),Notation.parse(running[2]))<0) return;
   applyPostChallenge(layerKey,running[0])
   player.L[layerKey].C = ['',0,'']
}
,assignChallenges = trigger=>layerKeys.forEach(layerKey=>assignLayerChallenge(layerKey,trigger))
,endLayerChallenge = (layerKey)=>{
   var running = getChallengeRunning(layerKey)
   if(!running[0]) return;
   applyPostChallenge(layerKey,running[0])
   player.L[layerKey].C = ['',0,'']
}
var getCostText = (layerKey,thingKey)=>{
   var thing = getLayerThings(layerKey).get(thingKey)
   var costs = thing?.costs
   if(!costs) return ''
   var amount = thing.type==='upgrade'?0:getBuyable(layerKey,thingKey)
   return costs.map(single=>single.cost?
      format(single.cost(amount),true)+' '+
      (typeof single.layer==='string'?getThingShortname(single.layer,single.thing):
      getLayerThings(layerKey).get('P').shortname||'points')
      :''
   ).filter(e=>e).join('<br>')
}
,getLayerFullname = layerKey=>layers[layerKey].fullname||Notation.display(Notation.parse(layerKey))
,getLayerShortname = layerKey=>layers[layerKey].shortname||Notation.displayShort(Notation.parse(layerKey))
,getThingFullname = (layerKey,thingKey)=>{
   var thing = getLayerThings(layerKey).get(thingKey)
   return thing?.fullname||thing?.shortname||(thingKey==='P'?getLayerFullname(thingKey)+'points':getLayerFullname(layerKey)+thingKey)
}
,getThingShortname = (layerKey,thingKey)=>{
   var thing = getLayerThings(layerKey).get(thingKey)
   return thing?.shortname||(thingKey==='P'?'points':getLayerShortname(layerKey)+thingKey)
}
,format = (num,isInt=false,precision=player.D)=>{
   var dnum = new Decimal(num)
   return isInt&&Decimal.pow10(precision-1).gt(dnum.abs()) ? dnum.toFixed(0) : dnum.toPrecision(precision)
}
,formatFloor = (num,precision=player.D)=>{
   var dnum = Decimal.floor(num)
   return Decimal.pow10(precision-1).gt(dnum.abs()) ? dnum.toFixed(0) : dnum.toPrecision(precision)
}
,formatPercent = (num,precision=player.D)=>{
   var dnum = new Decimal(num)
   if(!canShowPercent(dnum,precision)) return ''
   var percent = dnum.sub(dnum.floor()).mul(100)
   if(ONE.gt(dnum)) return percent.toPrecision(precision)
   return percent.toFixed(Decimal.sub(precision-2,dnum.log10().floor().add(ONE)))
}
,canShowPercent = (num,precision=player.D)=>Decimal.pow10(precision-2).gt(Decimal.abs(num))