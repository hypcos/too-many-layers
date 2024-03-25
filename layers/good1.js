var pricePenalty = (layerKey,thingKey)=>{
   var x = getThingAmount('o1','p')?.[layerKey]?.[thingKey]||ZERO
   return Decimal.lt(x,1024)?new Decimal(2**x):TWO.pow(x).round()
}
,invPricePenalty = (layerKey,thingKey)=>{
   var x = getThingAmount('o1','p')?.[layerKey]?.[thingKey]||ZERO
   return Decimal.lt(x,1024)?new Decimal(0.5**x):HALF.pow(x)
}
,applyMyopiaPenalty = (layerKey,thingKey,mult)=>{
   if(!getChallengeDifficulty('o1','C1')) return mult
   var m = getThingAmount('o1','m')
   if(m[0]===layerKey&&m[1]===thingKey) return mult
   if(TEN.lt(mult)) return mult.log10().sqrt().pow10()
   return mult
}
,antimatterPenalty = ()=>getChallengeDifficulty('o1','C3')?getComputed('o1','a_mult')||ONE:ONE
,taxPenalty = layerKey=>{
   var d=getChallengeDifficulty('o1','C4')
   if(d) return Decimal.pow(1-scaleTax(d,1e5),getThingAmount('o1','t')?.[layerKey]||ZERO)
   else return ONE
}
var scaleTax = (d,range)=>(range**(d*.02)-1)/(range-1)
var antimatter_temp = new Map()
layerFactories.push({accept:expr=>expr.length===NOTATION_OFFSET+2&&
   expr[NOTATION_OFFSET+1]+''==='1'&&
   !expr[NOTATION_OFFSET].length&&
   !expr[0].length,
output:()=>{
   var calcSingleSingleDoubling = (singleValue,buyingArraySingle)=>{
      if(buyingArraySingle[2].lt(singleValue)) return ['none']
      var starting = buyingArraySingle[1].log2().sub(singleValue.log2()).ceil().max(ZERO)
      if(buyingArraySingle[0].invCost(singleValue).lte(Number.MAX_SAFE_INTEGER)) for(var i=0;i<9;++i){
         var raised = TWO.pow(starting.add(i)).mul(singleValue)
         if(buyingArraySingle[2].lt(singleValue)||
         !buyingArraySingle[0].cost(buyingArraySingle[0].invCost(raised)).eq_tolerance(raised,7.5e-15)){
            return i>1?['range',starting,starting.add(i-1)]:i?['discrete',starting]:['discrete']
         }
      }
      if(buyingArraySingle[3]) return ['discrete',starting]
      var ending = buyingArraySingle[2].log2().sub(singleValue.log2()).floor()
      if(ending.lt(starting)) return ['discrete']
      if(ending.eq(starting)) return ['discrete',starting]
      return ['range',starting,ending]
   }
   var calcSingleDoubling = (singleValue,buyingArray,offset)=>{
      var res = buyingArray.slice(offset).map(buyingArraySingle=>calcSingleSingleDoubling(singleValue,buyingArraySingle))
      for(var i=0;res[i]?.[0]==='none';++i);
      res = res.slice(i).filter(x=>x.length>1)
      return [offset+i].concat(res)
   }
   var calcDoubling = (sortedValues,buyingArray)=>{//both must be sorted, buyingArray is sorted using upper bounds
      var offset=0,i=0,collection=[],res
      while(i<sortedValues.length){
         res = calcSingleDoubling(sortedValues[i],buyingArray,offset)
         offset = res.shift()
         collection = collection.concat(res)
         ;++i
      }
      collection = collection.sort((a,b)=>a[1].cmp(b[1]))
      var doubling = ZERO
      for(i=0;i<collection.length;++i){
         if(doubling.lt(collection[i][1])) return doubling
         if(collection[i].length>2) doubling = doubling.max(ONE.add(collection[i][2]))
         else doubling = doubling.max(ONE.add(collection[i][1]))
      }
      return doubling
   }
   var pricePostBuy = (lk,tk,incr,prev)=>{
      var doublings = getThingAmount('o1','p')
      ,buyingCosts = getLayerThings(lk).get(tk).costs
      ,upperamount = NEGONE.add(incr).add(prev)
      var hasEqual = (orderSeq1,orderSeq2)=>{
         var i=orderSeq1.length-1,j=orderSeq2.length-1
         while(i>=0&&j>=0){
            var left=orderSeq1[i]
            var right=orderSeq2[j]
            if(left.eq_tolerance(right,7.5e-15)) return true
            if(left.gt(right)) --i
            else --j
         }
         return false
      }
      if(upperamount.lte(prev)){
         var buyingStartings = buyingCosts.map(single=>single.cost(prev)).sort((a,b)=>a.cmp(b))
         return layerKeys.forEach(layerKey=>{
            var dl = doublings[layerKey]
            if(!dl) dl = doublings[layerKey] = {}
            getLayerThings(layerKey).forEach((thing,thingKey)=>{
               var costs = thing.costs
               if(!costs||(layerKey===lk&&thingKey===tk)) return;
               var amount
               if(thing.type==='buyable') amount = getBuyable(layerKey,thingKey)
               else if(thing.type==='upgrade'&&!hasUpgrade(layerKey,thingKey)) amount = ZERO
               else return;
               if(!hasEqual(costs.map(single=>single.cost(amount)).sort((a,b)=>a.cmp(b)),buyingStartings)) return;
               if(!dl[thingKey]) dl[thingKey] = 1
               else dl[thingKey] = ONE.add(dl[thingKey])
            })
         })
      }
      var buyingIntervals = buyingCosts.map(single=>{
         var cost1 = single.cost(prev), cost2 = single.cost(upperamount)
         return [single,cost1,cost2,cost2.log2().sub(cost1.log2()).gt(NEGONE.add(incr))]
      }).sort((a,b)=>a[2].cmp(b[2]))
      layerKeys.forEach(layerKey=>{
         var dl = doublings[layerKey]
         if(!dl) dl = doublings[layerKey] = {}
         getLayerThings(layerKey).forEach((thing,thingKey)=>{
            var costs = thing.costs
            if(!costs||thing.hidden?.()||(layerKey===lk&&thingKey===tk)) return;
            var amount
            if(thing.type==='buyable') amount = getBuyable(layerKey,thingKey)
            else if(thing.type==='upgrade'&&!hasUpgrade(layerKey,thingKey)) amount = ZERO
            else return;
            var delta = calcDoubling(costs.map(single=>single.cost(amount)).sort((a,b)=>a.cmp(b)),buyingIntervals)
            if(!dl[thingKey]) dl[thingKey] = delta
            else dl[thingKey] = delta.add(dl[thingKey])
         })
      })
   }
   var myopiaPostBuy = (layerKey,thingKey)=>setThingAmount('o1','m',[layerKey,thingKey])
   var pricePostPrestige = (layerKey)=>{
      var doublings = getThingAmount('o1','p')
      layerKeys.slice(layerKeys.indexOf(layerKey)+1).forEach(l=>doublings[l]={})
   }
   var antimatterPrePrestige = (layerKey)=>{
      var speeds = getThingAmount('o1','a')
      speeds[layerKey] = getPointGain(layerKey).div(Math.max(player.L[layerKey].t,.001)).sqrt().div(60)
      layerKeys.slice(layerKeys.indexOf(layerKey)+1).forEach(l=>speeds[l]=0)
   }
   var taxPostPrestige = (layerKey)=>{
      var counts = getThingAmount('o1','t')
      var idx = layerKeys.indexOf(layerKey)
      layerKeys.slice(0,idx+1).forEach(l=>{
         counts[l]===undefined&&(counts[l] = 0)
         ;++counts[l]
      })
      layerKeys.slice(idx+1).forEach(l=>counts[l]=0)
   }
   var antimatterText = (layerKey)=>{
      var speed = getThingAmount('o1','a')?.[layerKey]||0
      return 'Antimatter Challenge: There is '+format(Decimal.mul(speed,player.L[layerKey].t).add(1))+
      ' antimatter (+ '+format(speed)+'/s) in this layer'
   }
   var taxText = (layerKey)=>{
      var eff = Decimal.pow(1-scaleTax(getChallengeDifficulty('o1','C4'),1e5),getThingAmount('o1','t')?.[layerKey]||0)
      return 'Tax Challenge: your reset gain of this layer is '+
      (eff.eq(ZERO)? 'zero' : eff.lt(.1) ? 'divided by '+format(eff.recip()) : 'decreased by '+format(ONE.sub(eff).mul(100))+'%')
   }
   switch(getChallengeRunning('o1')[0]){
   case 'C1':
      postBuy.has('o1"C1')||postBuy.set('o1"C1',myopiaPostBuy)
      break
   case 'C2':
      postBuy.has('o1"C2')||postBuy.set('o1"C2',pricePostBuy)
      postPrestige.has('o1"C2')||postPrestige.set('o1"C2',pricePostPrestige)
      break
   case 'C3':
      prePrestige.has('o1"C3')||prePrestige.set('o1"C3',antimatterPrePrestige)
      extraTexts.has('o1"C3')||extraTexts.set('o1"C3',antimatterText)
      break
   case 'C4':
      postPrestige.has('o1"C4')||postPrestige.set('o1"C4',taxPostPrestige)
      extraTexts.has('o1"C4')||extraTexts.set('o1"C4',taxText)
      break
   }
   preChallenge.has('o1')||preChallenge.set('o1',(layerKey,challKey)=>{
      if(layerKey!=='o1') return;
      switch(challKey){
      case 'C1':
         postBuy.set('o1"C1',myopiaPostBuy)
         break
      case 'C2':
         postBuy.set('o1"C2',pricePostBuy)
         postPrestige.set('o1"C2',pricePostPrestige)
         break
      case 'C3':
         prePrestige.set('o1"C3',antimatterPrePrestige)
         extraTexts.set('o1"C3',antimatterText)
         break
      case 'C4':
         postPrestige.set('o1"C4',taxPostPrestige)
         extraTexts.set('o1"C4',taxText)
         break
      }
   })
   postChallenge.has('o1')||postChallenge.set('o1',(layerKey,challKey)=>{
      if(layerKey!=='o1') return;
      switch(challKey){
      case 'C1':
         setThingAmount('o1','m',['',''])
         postBuy.delete('o1"C1')
         break
      case 'C2':
         setThingAmount('o1','p',{})
         postBuy.delete('o1"C2')
         postPrestige.delete('o1"C2')
         break
      case 'C3':
         setThingAmount('o1','a',{})
         prePrestige.delete('o1"C3')
         extraTexts.delete('o1"C3')
         break
      case 'C4':
         setThingAmount('o1','t',{})
         postPrestige.delete('o1"C4')
         extraTexts.delete('o1"C4')
         break
      }
   })
   extraKeeps.has('o1"reward')||extraKeeps.set('o1"reward',(firing,target)=>{
      var cmp = Notation.compare(Notation.parse(firing),Notation.parse(target))
      if(!cmp&&getChallengeCompletion('o1','C2',firing)) return ['everything']
      if(cmp<0&&getChallengeCompletion('o1','C1',firing)) return ['everything']
      if(getChallengeCompletion('o1','C3',firing)) return layers[target]?.auto?.slice?.(1)||[]
      return []
   })
   return {
      things:new Map([
         ['C1',{
            type:'challenge',
            challengeReject:(trigger,difficulty)=>{
               var expr = Notation.parse(trigger)
               if(expr.length<=NOTATION_OFFSET) return true
               if(expr.length>NOTATION_OFFSET+1) return false
               var seq = expr[NOTATION_OFFSET]
               if(!seq.every(e=>e===1)) return false
               while(seq.length>0){
                  if(getChallengeCompletion('o1','C1',seq.join())<difficulty) return false
                  seq.pop()
               }
               return true
            },
            fullname:'Myopia Challenge',
            description:()=>'<br>A generator works normally if it is latest bought, otherwise it works much slower.'+
               '<br><br>For each layer you have reached: it does not reset productions in higher layers.',
            tooltip:'Multiplier above 10 reduces to 10^lg(multiplier)^0.5',
         }],//remember the last bought thing = [layerKey,thingKey]
         ['m',{description:()=>{
            var keys = Object.keys(getThingAmount('o1','C1'))
            if(!keys.length) return ''
            return 'You completed Myopia Challenge for: '+
            keys.sort((a,b)=>Notation.compare(Notation.parse(a),Notation.parse(b))).map(getLayerShortname).join(' and ')
         }}],
         ['C2',{
            type:'challenge',
            challengeReject:(trigger,difficulty)=>{
               var expr = Notation.parse(trigger)
               if(expr.length<=NOTATION_OFFSET) return true
               if(expr.length>NOTATION_OFFSET+1) return false
               var seq = expr[NOTATION_OFFSET]
               if(!seq.every(e=>e===1)) return false
               while(seq.length>0){
                  if(getChallengeCompletion('o1','C2',seq.join())<difficulty) return false
                  seq.pop()
               }
               return true
            },
            fullname:'Price Challenge',
            description:()=>'<br>When buying anything, other things with equal cost (ignoring unit) double their price.'+
               '<br><br>For each layer you have reached: it does not reset its productions.',
            tooltip:'When a layer gets reset, the penalty of everything in it also resets'+
               '<br>Due to inaccurate implement, buying something with amount 1e14 or higher may cause more penalty',
         }],//remember price doublings for each upgrade/buyable (p[layerKey][thingKey])
         ['p',{description:()=>{
            var keys = Object.keys(getThingAmount('o1','C2'))
            if(!keys.length) return ''
            return 'You completed Price Challenge for: '+
            keys.sort((a,b)=>Notation.compare(Notation.parse(a),Notation.parse(b))).map(getLayerShortname).join(' and ')
         }}],
         ['C3',{
            type:'challenge',
            challengeReject:(trigger,difficulty)=>{
               var expr = Notation.parse(trigger)
               if(expr.length<=NOTATION_OFFSET) return true
               if(expr.length>NOTATION_OFFSET+1) return false
               var seq = expr[NOTATION_OFFSET]
               if(!seq.every(e=>e===1)) return false
               while(seq.length>1){
                  if(getChallengeCompletion('o1','C3',seq.join())<difficulty) return false
                  seq.pop()
               }
               return true
            },
            assignReject:trigger=>trigger.length<=1,
            hidden:()=>!player.L['1,1,1'],
            fullname:'Antimatter Challenge',
            description:()=>'<br>Each layer has antimatter. '+
               'Antimatter grows depending on how fast point gained in previous reset, and divides all productions.'+
               '<br><br>For each layer you have reached: it does not reset automation.',
            tooltip:'Antimatter/min = (points/s gained in previous reset)^0.5'+
               '<br>Not suitable for layer 1',
         }],//remember antimatter/sec for each layer
         ['a',{description:()=>{
            var keys = Object.keys(getThingAmount('o1','C3'))
            if(!keys.length) return ''
            return 'You completed Antimatter Challenge for: '+
            keys.sort((a,b)=>Notation.compare(Notation.parse(a),Notation.parse(b))).map(getLayerShortname).join(' and ')
         }}],
         ['a_mult',{type:'computed',calc:()=>{
            var speeds = getThingAmount('o1','a')
            ,prod = ONE
            if(!speeds) return prod
            layerKeys.forEach(layerKey=>{
               if(!speeds[layerKey]) return;
               prod = prod.mul(Decimal.mul(speeds[layerKey],player.L[layerKey].t).add(ONE))
            })
            return prod.recip()
         }}],
         ['C4',{
            type:'challenge',
            challengeReject:(trigger,difficulty)=>{
               var expr = Notation.parse(trigger)
               if(expr.length<=NOTATION_OFFSET) return true
               if(expr.length>NOTATION_OFFSET+1) return false
               var seq = expr[NOTATION_OFFSET]
               if(!seq.every(e=>e===1)) return false
               while(seq.length>1){
                  if(getChallengeCompletion('o1','C4',seq.join())<difficulty) return false
                  seq.pop()
               }
               return true
            },
            assignReject:trigger=>trigger.length<=1,
            hidden:()=>!player.L['1,1,1'],
            difficultyMax:50,
            fullname:'Tax Challenge',
            description:()=>{
               var d = queueDifficulty.o1?.C4||1
               ,eff = scaleTax(d,1e5)
               return '<br>When any layer resets, each layer '+
               ('decreases point gain by '+format(eff*100)+'%')+
               '.<br><br>For each layer you have reached: improve point gain formula.'
            },
            tooltip:'When a layer gets reset, its penalty also resets'+
               '<br>Not suitable for layer 1',
         }],//remember reset counts for each layer
         ['t',{description:()=>{
            var keys = Object.keys(getThingAmount('o1','C4'))
            if(!keys.length) return ''
            return 'You completed Tax Challenge for: '+ keys.sort((a,b)=>Notation.compare(Notation.parse(a),Notation.parse(b)))
               .map(layerKey=>{
                  var d = getChallengeCompletion('o1','C4',layerKey)
                  return getLayerShortname(layerKey)+
                  (d===50?'':' ('+getChallengeCompletion('o1','C4',layerKey)+'/50)')
               }).join(' and ')
         }}],
      ]),
      layout:{
         challenges:['C1','C2','C3','C4'],
         challTexts:['m','p','a','t'],
      },
      initial:{m:['',''],p:{},a:{},t:{}},
      hidden:()=>!hasUpgrade('1','U1'),
   }
}})