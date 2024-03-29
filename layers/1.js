layerFactories.push({accept:expr=>expr.length===NOTATION_OFFSET+1&&
   expr[NOTATION_OFFSET].every(e=>e===1)&&
   !expr[0].length,
output:expr=>{
   var n = expr[NOTATION_OFFSET].length
   ,layerKey = Notation.invParse(expr)
   var nextExprs = Array(1)
   for(var i=1;i<=5;++i) nextExprs[i] = [[],expr[NOTATION_OFFSET].concat(Array(i).fill(1))]
   var nextKeys = nextExprs.map(Notation.invParse)
   var prevExprs = Array(1)
   for(i=1;i<=5&&i<n;++i) prevExprs[i] = [[],expr[NOTATION_OFFSET].slice(0,-i)]
   var prevKeys = prevExprs.map(Notation.invParse)
   extraKeeps.has('1')||extraKeeps.set('1',(firing,target)=>target==='1'?'U1':[])
   var point,upgs,normalBuys,extraBuys,buyables
   point = [['P',{
      Pmode:'normal',
      Pgain:()=>{
         var gain = (n>1?getPointGain(prevKeys[1]).add(getPoint(prevKeys[1])):getPointGain('').add(getPoint('')))
         .sqrt().mul(Decimal.pow10(-(n**(1-scaleTax(getChallengeCompletion('o1','C4',layerKey),1000)))))
         //bonus
         hasUpgrade(layerKey,'U2')&&(gain = TEN.add(getThingAmount(prevKeys[1],'E0')).log10().mul(gain))
         //challenge penalty
         gain = taxPenalty(layerKey).mul(gain)
         return gain
      },
      description:()=>(n>1?', multiplying '+Notation.displayShort(prevExprs[1])+' production by '
         :', multiplying number production by ')+
         format(getComputed(layerKey,'P_effect')||ONE)+' ((1+points)^0.25)',
      tooltip:n>1 ? (()=>{
         var C4 = getChallengeCompletion('o1','C4',layerKey)
         return 'Gain formula: ('+Notation.displayShort(prevExprs[1])+'P)^0.5 / 10^'+n+
         (C4? '^'+(C4===50?'0.001':format(1-scaleTax(C4,1000))) :'')+
         (hasUpgrade('1','U1')&&player.L['1,1,1']?'<br>Tax reward: ^'+n+' -> ^'+n+'^(1-(1000^(completion/50)-1)/1000)':'')
      }) : 'Prestige, meaning you gain some points of this layer<br>But as a cost, all lower layer contents will be reset'+
      '<br>Gain formula: (number)^0.5 / 10',
   }],
   ['P_effect',{type:'computed',calc:()=>ONE.add(getPoint(layerKey)).sqrt().sqrt()}]]
   upgs = [['U0',{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty(layerKey,'U0').mul(3),
         invCost:()=>ZERO,
      }],
      shortname:'U11',
      description:n>1?(()=>'Autobuyer for '+Notation.displayShort(prevExprs[1])):(()=>'Autobuyer for number generator'),
   },3],['U1',n>1?{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty(layerKey,'U1').mul(14),
         invCost:()=>ZERO,
      }],
      shortname:'U12',
      description:()=>'Autoprestiger for '+Notation.displayShort(prevExprs[1]),
   }:{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty(layerKey,'U1').mul(100),
         invCost:()=>ZERO,
      }],
      shortname:'U12',
      description:()=>'Unlock (good layer 1) challenges',
      tooltip:'This is permanent',
   },14]]
   if(n>1) upgs.push(['U2',{
      type:'upgrade',
      costs:[{
         cost:()=>pricePenalty(layerKey,'U2').mul(Decimal.pow(64,n-1).mul(3)),
         invCost:()=>ZERO,
      }],
      shortname:'U1'+Math.min(n+2,8),
      description:()=>Notation.displayShort(prevExprs[1])+' Energy affects '+Notation.displayShort(expr)+'P gain'+
      '<br>Currently: ×'+format(TEN.add(getThingAmount(prevKeys[1],'E0')).log10()),
      tooltip:'Formula: lg(10+X)',
   },192])
   var upgFactory = i=>{
      var thingKey1 = 'U'+(i+2).toString(32)
      var rawCost1 = 2<<i
      return [thingKey1,{
         type:'upgrade',
         costs:[{
            cost:()=>pricePenalty(layerKey,thingKey1).mul(rawCost1),
            invCost:()=>ZERO,
         }],
         shortname:'U1'+(i+2),
         description:()=>'Have one additional '+Notation.displayShort(prevExprs[i])+' Generator',
      },rawCost1]
   }
   for(i=1;i<=5&&i<n;++i) upgs.push(upgFactory(i))
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
   normalBuys = [['G0',{
      type:'buyable',
      costs:[{
         sumcost:x=>pow2sumcost(x).mul(pricePenalty(layerKey,'G0')),
         invSumcost:y=>pow2invSumcost(invPricePenalty(layerKey,'G0').mul(y)),
         cost:x=>pow2cost(x).mul(pricePenalty(layerKey,'G0')),
         invCost:y=>pow2invCost(invPricePenalty(layerKey,'G0').mul(y)),
      }],
      fullname:'Generator',
      tooltip:'Produce Energy<br>Cost formula: (1+amount)',
   }],['G0_add',{type:'computed',calc:()=>{
      var extra = ZERO
      for(var i=1;i<=5;++i) extra = extra.add(Math.sign(hasUpgrade(nextKeys[i],'U'+(i+2).toString(32))))
      return extra
   }}],['G0_mult',{type:'computed',calc:()=>{
      var mult = ONE.add(getProduced(nextKeys[1],'E0'))
      .mul(getComputed(nextKeys[1],'P_effect')||ONE)
      mult = ONE.add(getProduced('1,2','E0')).mul(mult)
      if(getComputed('1,2','P_target')?.has(n)) mult = (getComputed('1,2','P_effect')||ONE).mul(mult)
      //challenge penalty
      mult = applyMyopiaPenalty(layerKey,'G0',mult)
      mult = antimatterPenalty().mul(mult)
      return mult
   }}],['E0',{type:'produced',description:()=>'You have '+format(getProduced(layerKey,'E0'))+
      ' Energy (+ '+format(getComputed(layerKey,'E0_speed')||ZERO)+'/s)'+
      (n>1?', multiplying '+Notation.displayShort(prevExprs[1])+' production by ':', multiplying number production by ')+
      format(ONE.add(getProduced(layerKey,'E0')))
   }],['E0_speed',{type:'computed',calc:()=>(getComputed(layerKey,'G0_add')||ZERO)
      .add(getBuyable(layerKey,'G0')).mul(getComputed(layerKey,'G0_mult')||ONE)
   }]]
   extraBuys = []
   buyables = [[['G0']]]
   return {
      things:new Map(point.concat(upgs,extraBuys,normalBuys)),
      auto:n>1?[prevKeys[1],'U0','U1']:['','U0'],
      layout:{
         colors:'cell1',
         P:true,
         upgrades,
         buyables,
         buyableTexts:['E0'],
      },
      production:dt=>{
         setThingAmount(layerKey,'E0',(getComputed(layerKey,'E0_speed')||ZERO).mul(dt).add(getProduced(layerKey,'E0')))
      },
   }
}})