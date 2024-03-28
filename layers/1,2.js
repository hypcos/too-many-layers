var finiteCost = (layerKey,thingKey,array)=>{
   var cap = array.length
   var cost = n=>Decimal.lt(n,cap)?pricePenalty(layerKey,thingKey).mul(array[+n]):INF
   var sumarray = [ZERO]
   for(var i=1;i<=cap;++i) sumarray[i] = sumarray[i-1].add(array[i-1])
   var sumcost = n=>Decimal.lte(n,cap)?pricePenalty(layerKey,thingKey).mul(sumarray[+n]):INF
   var invSumcost = y=>{
      var rawy = invPricePenalty(layerKey,thingKey).mul(y)
      return new Decimal(sumarray.findLastIndex(s=>rawy.gte(s)))
   }
   var invCost = y=>{
      var rawy = invPricePenalty(layerKey,thingKey).mul(y)
      return new Decimal(array.findLastIndex(s=>rawy.gte(s)))
   }
   return {sumcost,invSumcost,cost,invCost}
}
var dynamicFiniteCost = (layerKey,thingKey,getArray)=>({
   cost:n=>{
      var array = getArray()
      return Decimal.lt(n,array.length)?pricePenalty(layerKey,thingKey).mul(array[+n]):INF
   },
   invCost:y=>{
      var array = getArray()
      var rawy = invPricePenalty(layerKey,thingKey).mul(y)
      return new Decimal(array.findLastIndex(s=>rawy.gte(s)))
   },
   sumcost:n=>{
      var array = getArray()
      var cap = array.length
      var sumarray = [ZERO]
      for(var i=1;i<=cap;++i) sumarray[i] = sumarray[i-1].add(array[i-1])
      return Decimal.lte(n,cap)?pricePenalty(layerKey,thingKey).mul(sumarray[+n]):INF
   },
   invSumcost:y=>{
      var array = getArray()
      var cap = array.length
      var sumarray = [ZERO]
      for(var i=1;i<=cap;++i) sumarray[i] = sumarray[i-1].add(array[i-1])
      var rawy = invPricePenalty(layerKey,thingKey).mul(y)
      return new Decimal(sumarray.findLastIndex(s=>rawy.gte(s)))
   },
})
layerFactories.push({accept:expr=>expr.length===NOTATION_OFFSET+1&&
   expr[NOTATION_OFFSET]+''==='1,2'&&
   !expr[0].length,
output:()=>{
   var getShortname = n=>{
      var expr = Array(NOTATION_OFFSET).fill([])
      expr.push(Array(n).fill(1))
      return Notation.displayShort(expr)
   }
   var getDownshiftsAbove = (n,including=false)=>{
      var nmax = +getBuyable('1,2','Tn')
      var boughts = Array(nmax+1)
      if(including) for(var i=nmax;i>=n;--i) boughts[i] = +getBuyable('1,2','T'+i)
      else for(i=nmax;i>n;--i) boughts[i] = +getBuyable('1,2','T'+i)
      return boughts
   }
   var point = [['P',{
      Pmode:'normal',
      Pgain:()=>{
         var gain = ZERO
         var n,expr,layerKey
         for(n=1;true;++n){
            expr = Array(NOTATION_OFFSET).fill([])
            expr.push(Array(n).fill(1))
            layerKey = Notation.invParse(expr)
            if(!player.L[layerKey]) break
            gain = TEN.add(getPointGain(layerKey)).add(getPoint(layerKey)).log10().log10().add(gain)
         }
         gain = gain.sqrt().mul(.75+scaleTax(getChallengeCompletion('o1','C4','1,2'),200)*8).add(-3).pow10()
         //challenge penalty
         gain = taxPenalty('1,2').mul(gain)
         return gain
      },
      description:()=>{
         var l = []
         getComputed('1,2','P_target').forEach(n=>l.push(getShortname(n)))
         return ', multiplying '+l.join(' and ')+
         ' productions by '+format(getComputed('1,2','P_effect')||ONE)
      },
      tooltip:()=>'Gain formula: 10^((lglg(10+'+getShortname(1)+
      'P) +lglg(10+'+getShortname(2)+
      'P) +lglg(10+'+getShortname(3)+
      'P) +...)^0.5×'+format(.75+scaleTax(getChallengeCompletion('o1','C4','1,2'),200)*8)+
      '-3)<br>Tax reward: ×0.75 -> ×(0.75+(200^(completion/50)-1)/200×8)',
   }],['P_effect',{
      type:'computed',
      calc:()=>ONE.add(getPoint('1,2')),
   }],['P_target',{
      type:'computed',
      calc:()=>{
         var boughts = getDownshiftsAbove(0,true)
         var accumulate = []
         boughts.reduceRight((prev,cur,i)=>accumulate[i]=prev+cur,0)
         return new Set(accumulate.map((x,n)=>8+n-x))
      },
   }]]
   var upgs = [['U0',{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty('1,2','U0').mul(32),
         invCost:()=>ZERO,
      }],
      shortname:'U11',
      description:()=>'Autobuyer for highest L1,1,1,... with total points≥1',
   },32],['U1',{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty('1,2','U1').mul(1536),
         invCost:()=>ZERO,
      }],
      shortname:'U12',
      description:()=>'Autoprestiger for L1,1,1,...',
      tooltip:'It tries high-to-low until a layer met the trigger condition',
   },1536]]
   upgs.sort((a,b)=>Decimal.cmp(a[2],b[2]))
   var upgrades = []
   upgs.forEach(a=>{
      var shortname = a[1].shortname.slice(1)
      var x = shortname.slice(0,-1)-1
      var y = shortname.slice(-1)-1
      if(!upgrades[x]) upgrades[x] = []
      upgrades[x][y] = a[0]
      a.pop()
   })
   var normalBuys = [['Tn',{
      type:'buyable',
      costs:[{
         cost:x=>Decimal.pow(32,ONE.add(x)).round().mul(pricePenalty('1,2','Tn')),
         invCost:y=>invPricePenalty('1,2','Tn').mul(y).log(32).add(NEGONE).round(),
         sumcost:x=>Decimal.pow(32,x).add(NEGONE).mul(32/31).round().mul(pricePenalty('1,2','Tn')),
         invSumcost:y=>invPricePenalty('1,2','Tn').mul(y).mul(31/32).add(1.5).log(32).floor(),
      }],
      effect:(amount)=>{
         if(ONE.lte(amount)) for(var n=+amount;n--;) resetThing('1,2','T'+n);
         if(Decimal.gt(amount,getThingAmount('1,2','Tm'))){
            setThingAmount('1,2','Tm',amount)
            updateLayerInfo('1,2')
         }
      },
      fullname:'Points Effect',
      description:()=>'<br>Points apply on one more layer',
      tooltip:'Buying this will reset Downshifts back with higher costs!'+
      '<br>Cost formula: 32^(1+amount)',
   }],['Tm',{}]]
   var TnFactory = n=>n>0?['T'+n,{
      type:'buyable',
      costs:[{
         sumcost:x=>{
            var higherBoughts = getDownshiftsAbove(n)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            if(Decimal.gt(x,cap)) return INF
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return pow2sumcost(x).mul(mult).mul(TWO.pow(3*(higherBoughts.length-1)+2*n).round())
            .mul(pricePenalty('1,2','T0'))
         },
         invSumcost:y=>{
            var higherBoughts = getDownshiftsAbove(n)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return Decimal.min(pow2invSumcost(invPricePenalty('1,2','T0').mul(HALF.pow(3*(higherBoughts.length-1)+2*n)).div(mult).mul(y))
            ,cap)
         },
         cost:x=>{
            var higherBoughts = getDownshiftsAbove(n)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            if(Decimal.gte(x,cap)) return INF
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return pow2cost(x).mul(mult).mul(TWO.pow(3*(higherBoughts.length-1)+2*n).round())
            .mul(pricePenalty('1,2','T0'))
         },
         invCost:y=>{
            var higherBoughts = getDownshiftsAbove(n)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return Decimal.min(pow2invCost(invPricePenalty('1,2','T0').mul(HALF.pow(3*(higherBoughts.length-1)+2*n)).div(mult).mul(y))
            ,cap-1)
         },
      }],
      effect:(amount)=>{
         if(ONE.lte(amount)) for(var i=n;i--;) resetThing('1,2','T'+i)
      },
      hidden:()=>Decimal.lt(getBuyable('1,2','Tn'),n),
      fullname:'Downshift '+(n+1),
      description:()=>{
         var sum = getDownshiftsAbove(n,true).reduceRight((prev,cur)=>prev+cur,0)
         return sum<7+n?'<br>Points apply on '+getShortname(7+n-sum)+' instead of '+getShortname(8+n-sum):''
      },
      tooltip:'Buying this will reset lower Downshifts back with higher costs!',
   }]:['T0',{
      type:'buyable',
      costs:[{
         sumcost:x=>{
            var higherBoughts = getDownshiftsAbove(0)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            if(Decimal.gt(x,cap)) return INF
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return pow2sumcost(x).mul(mult).mul(TWO.pow(3*(higherBoughts.length-1)).round())
            .mul(pricePenalty('1,2','T0'))
         },
         invSumcost:y=>{
            var higherBoughts = getDownshiftsAbove(0)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return Decimal.min(pow2invSumcost(invPricePenalty('1,2','T0').mul(HALF.pow(3*(higherBoughts.length-1))).div(mult).mul(y))
            ,cap)
         },
         cost:x=>{
            var higherBoughts = getDownshiftsAbove(0)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            if(Decimal.gte(x,cap)) return INF
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return pow2cost(x).mul(mult).mul(TWO.pow(3*(higherBoughts.length-1)).round())
            .mul(pricePenalty('1,2','T0'))
         },
         invCost:y=>{
            var higherBoughts = getDownshiftsAbove(0)
            var cap = higherBoughts.reduceRight((prev,cur)=>prev-cur,7)
            var mult = higherBoughts.reduceRight((prev,cur)=>prev*(1+cur),1)
            return Decimal.min(pow2invCost(invPricePenalty('1,2','T0').mul(HALF.pow(3*(higherBoughts.length-1))).div(mult).mul(y))
            ,cap-1)
         },
      }],
      fullname:'Downshift 1',
      description:()=>{
         var sum = getDownshiftsAbove(0,true).reduceRight((prev,cur)=>prev+cur,0)
         return sum<7?'<br>Points apply on '+getShortname(7-sum)+' instead of '+getShortname(8-sum):''
      },
   }]
   var buyableRow_Tn = []
   for(var n=+getThingAmount('1,2','Tm');n>=0;--n){
      normalBuys.push(TnFactory(n))
      buyableRow_Tn.unshift('T'+n)
   }
   buyableRow_Tn.unshift('Tn')
   var extraBuys = []
   normalBuys.push(['G0',{
      type:'buyable',
      costs:[{
         sumcost:x=>pow2sumcost(x).mul(pricePenalty('1,2','G0')),
         invSumcost:y=>pow2invSumcost(invPricePenalty('1,2','G0').mul(y)),
         cost:x=>pow2cost(x).mul(pricePenalty('1,2','G0')),
         invCost:y=>pow2invCost(invPricePenalty('1,2','G0').mul(y)),
      }],
      fullname:'Generator 1',
      tooltip:'Produce Energy 1<br>Cost formula: (1+amount)',
   }],['G0_add',{type:'computed',calc:()=>{
      return ZERO
   }}],['G0_mult',{type:'computed',calc:()=>{
      return ONE
   }}])
   normalBuys.push(['E0',{type:'produced',description:()=>'You have '+format(getProduced('1,2','E0'))+
      ' Energy 1 (+ '+format(getComputed('1,2','E0_speed')||ZERO)+
      '/s), multiplying all lower layer productions by '+format(ONE.add(getProduced('1,2','E0')))
   }],['E0_speed',{type:'computed',calc:()=>{
      return (getComputed('1,2','G0_add')||ZERO).add(getBuyable('1,2','G0')).mul(getComputed('1,2','G0_mult')||ONE)
   }}])
   var buyables = [[buyableRow_Tn],[['G0']]]
   return {
      things:new Map(point.concat(upgs,extraBuys,normalBuys)),
      auto:[layerKey=>layerKey.split(',').every(x=>x==='1'),'U0','U1'],
      layout:{
         colors:'cell7',
         P:true,
         upgrades,
         buyables,
         buyableTexts:['E0'],
      },
      production:dt=>{
         setThingAmount('1,2','E0',(getComputed('1,2','E0_speed')||ZERO).mul(dt).add(getProduced('1,2','E0')))
      },
   }
}})