layerFactories.push({accept:expr=>expr.length===NOTATION_OFFSET+2&&
   expr[NOTATION_OFFSET+1]+''==='1'&&
   !expr[NOTATION_OFFSET].length&&
   !expr[NOTATION_OFFSET].length,
output:()=>{
   /*var getSingleDoublings = (x,[low,high])=>Decimal.lt(x,low)||Decimal.lte(high,x)?0:
      Decimal.log2(high).sub(Decimal.log2(x)).ceil()
   ,getDoublings = (x,ranges)=>ranges.map(r=>getSingleDoublings(x,r)).reduce(Decimal.max)
   var pricePostBuy = (lk,tk,incr,prev)=>{
      var ranges = []
      var cur = Decimal.add(prev,incr)
      getLayerThings(lk)[tk].costs.forEach(single=>ranges.push([single.cost(prev),single.cost(cur)]))
      ranges = ranges.sort((a,b)=>Decimal.cmp(a[0],b[0]))
      for(var i=0;i+1<ranges.length;){
         if(Decimal.lt(ranges[i][1],ranges[i+1][0])){
            ++i
            continue
         }
         ranges[i][1] = Decimal.max(ranges[i][1],ranges[i+1][1])
         ranges.splice(i+1,1)
      }
      var doublings = getThingAmount('o1','p')
      layerKeys.forEach(layerKey=>{
         var things = getLayerThings(layerKey)
         var dl = doublings[layerKey]
         if(!dl) dl = doublings[layerKey] = {}
         for(var thingKey in things){
            var costs = things[thingKey].costs
            if(!costs||(layerKey===lk&&thingKey===tk)) continue
            var amount = getThingAmount(layerKey,thingKey)
            ,C = costs.map(single=>single.cost(amount)).filter(e=>Decimal.dZero.lt(e))
            ,d,i
            for(i=0;i<C.length;){
               d=getDoublings(C[i],ranges)
               if(Decimal.dZero.gte(d)){
                  ++i
                  continue
               }
               if(!dl[thingKey]) dl[thingKey] = d
               else dl[thingKey] = Decimal.add(dl[thingKey],d)
               C = costs.map(single=>single.cost(amount)).filter(e=>Decimal.dZero.lt(e))
               i=0
            }
         }
      })
   }*/
   var pricePostBuy = ()=>endLayerChallenge('o1')//not implemented
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
      var eff = Decimal.pow(0.95,Decimal.pow(2.054079717745686,NEGONE.add(getChallengeDifficulty('o1','C4')))
      .mul(getThingAmount('o1','t')?.[layerKey]||0))
      return 'Tax Challenge: your reset gain of this layer is '+
      (eff.lt(.1) ? 'divided by '+format(eff.recip()) : 'decreased by '+format(ONE.sub(eff).mul(100))+'%')
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
   extraKeeps.has('o1"C1_reward')||extraKeeps.set('o1"C1_reward',(firing,target)=>{
      if(!getChallengeCompletion('o1','C1',firing)) return []
      return Notation.compare(Notation.parse(firing),Notation.parse(target))>0 ? [] : Array.from(getLayerThings(target).keys())
   })
   extraKeeps.has('o1"C2_reward')||extraKeeps.set('o1"C2_reward',(firing,target)=>{
      if(!getChallengeCompletion('o1','C2',firing)) return []
      var keep = []
      getLayerThings(target).forEach((thing,thingKey)=>thing.type==='upgrade'&&keep.push(thingKey))
      return keep
   })
   prePrestige.has('o1"C3_reward')||prePrestige.set('o1"C3_reward',(layerKey)=>{
      if(!getChallengeCompletion('o1','C3',layerKey)) return;
      layerKeys.slice(layerKeys.indexOf(layerKey)+1,-1)
      .forEach(l=>antimatter_temp.set(l,ONE.add(getPointGain(l)).add(getPoint(l)).log10().floor()))
   })
   postPrestige.has('o1"C3_reward')||postPrestige.set('o1"C3_reward',()=>{
      antimatter_temp.forEach((value,l)=>ZERO.lt(value)&&(setThingAmount(l,'P',value),setThingAmount(l,'',value)))
      antimatter_temp.clear()
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
               '<br><br>For each layer you have reached: it does not reset productions in itself or higher layers.',
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
               while(seq.length>1){
                  if(getChallengeCompletion('o1','C2',seq.join())<difficulty) return false
                  seq.pop()
               }
               return true
            },
            assignReject:trigger=>trigger.length<=1,
            hidden:()=>!player.L['1,1,1'],
            fullname:'Price Challenge',
            description:()=>'<br>When buying anything, other things with equal cost (ignoring unit) double their price.'+
               '<br><br>For each layer you have reached: it does not reset upgrades.',
            tooltip:'When a layer gets reset, the penalty of everything in it also resets'+
               '<br>Not suitable for layer 1',
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
               '<br><br>For each layer you have reached: when it resets, lower layers keep some points.',
            tooltip:'Antimatter/min = (points/s gained in previous reset)^0.5'+
               '<br>Points after reset = lg(1+(points before reset))'+
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
               ,eff = Decimal.pow(0.95,Decimal.pow(2.054079717745686,NEGONE.add(d)))
               return '<br>When reset, each layer gets a penalty that '+
               (eff.lt(.1) ? 'divides point gain by '+format(eff.recip())
               : 'decreases point gain by '+format(ONE.sub(eff).mul(100))+'%')+
               '.<br><br>For each layer you have reached: improve point gain formula.'
            },
            tooltip:'When a layer gets reset, its penalty also resets'+
               '<br>Not suitable for layer 1',
         }],//remember reset counts for each layer
         ['t',{description:()=>{
            var keys = Object.keys(getThingAmount('o1','C4'))
            if(!keys.length) return ''
            return 'You completed Tax Challenge for: '+ keys.sort((a,b)=>Notation.compare(Notation.parse(a),Notation.parse(b)))
               .map(layerKey=>getLayerShortname(layerKey)+' ('+getChallengeCompletion('o1','C4',layerKey)+'/50)').join(' and ')
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
var antimatter_temp = new Map()