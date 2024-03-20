layerFactories.push({accept:expr=>expr.length===NOTATION_OFFSET+1&&
   expr[NOTATION_OFFSET].every(e=>e===1)&&
   !expr[0].length,
output:expr=>{
   var n = expr[NOTATION_OFFSET].length
   ,layerKey = Notation.invParse(expr)
   ,nextKey = Notation.invParse([[],expr[NOTATION_OFFSET].concat(1)])
   ,prevExpr = [[],expr[NOTATION_OFFSET].slice(0,-1)]
   ,prevKey = Notation.invParse(prevExpr)
   extraKeeps.has('1')||extraKeeps.set('1',(firing,target)=>target==='1'?'U1':[])
   return {
      things:new Map([
         ['P',{
            Pmode:'normal',
            Pgain:()=>{
               var tax = 1-getChallengeCompletion('o1','C4',layerKey)*.02
               tax*=tax;tax*=tax
               var gain = getPointGain(prevKey).add(getPoint(prevKey)).sqrt().mul(Decimal.pow10(-(n**tax)))
               if(getChallengeDifficulty('o1','C4')){//tax penalty
                  var taxPenalty = Decimal.pow(0.95,2.054079717745686**(getChallengeDifficulty('o1','C4')-1)*
                  (getThingAmount('o1','t')?.[layerKey]||0))
                  gain = gain.mul(taxPenalty)
               }
               return gain
            },
            description:()=>(n>1?', multiplying '+Notation.displayShort(prevExpr)+' production by '
               :', multiplying number production by ')+
               format(getComputed(layerKey,'P_effect'))+' ((1+points)^0.25)',
            tooltip:n>1 ? (()=>{
               var C4 = getChallengeCompletion('o1','C4',layerKey)
               return 'Gain formula: ('+Notation.displayShort(prevExpr)+'P)^0.5'+
               (C4===50 ? ' / 10' : ' / 10^'+n+(C4? '^'+format((1-C4*.02)**4) :''))
            }) : 'Gain formula: (number)^0.5 / 10',
         }],
         ['P_effect',{type:'computed',calc:()=>ONE.add(getPoint(layerKey)).pow(.25)}],
         ['U0',{
            type:'upgrade',
            costs:[{
               cost:()=>TWO.pow(getThingAmount('o1','p')?.[layerKey]?.U0||ZERO).mul(3),
               invCost:()=>ZERO,
            }],
            effect:(has)=>has&&addAutobuyer(layerKey),
            shortname:'U11',
            description:n>1?(()=>'Autobuyer for '+Notation.displayShort(prevExpr)):(()=>'Autobuyer for number generator'),
         }],
         ['U1',n>1?{
            type:'upgrade',
            costs:[{
               cost:()=>TWO.pow(getThingAmount('o1','p')?.[layerKey]?.U1||ZERO).mul(14),
               invCost:()=>ZERO,
            }],
            effect:(has)=>has&&addAutoprestiger(layerKey),
            shortname:'U12',
            description:()=>'Autoreset for '+Notation.displayShort(prevExpr),
         }:{
            type:'upgrade',
            costs:[{
               cost:()=>TWO.pow(getThingAmount('o1','p')?.[layerKey]?.U1||ZERO).mul(100),
               invCost:()=>ZERO,
            }],
            shortname:'U12',
            description:()=>'Unlock (good layer 1) challenges',
            tooltip:'This upgrade is permanent.',
         }],
         ['G0',{
            type:'buyable',
            costs:[{
               sumcost:x=>pow2sumcost(x).mul(TWO.pow(getThingAmount('o1','p')?.[layerKey]?.G0||ZERO)).round(),
               invSumcost:y=>pow2invSumcost(HALF.pow(getThingAmount('o1','p')?.[layerKey]?.G0||ZERO).mul(y)),
               cost:x=>pow2cost(x).mul(TWO.pow(getThingAmount('o1','p')?.[layerKey]?.G0||ZERO)).round(),
               invCost:y=>pow2invCost(HALF.pow(getThingAmount('o1','p')?.[layerKey]?.G0||ZERO).mul(y)),
            }],
            fullname:Notation.display(expr)+' generator',
            tooltip:'Produce '+Notation.display(expr)+' energy<br>Cost formula: (1+amount)',
         }],
         ['G0_mult',{type:'computed',calc:()=>{
            var mult = ONE.add(getProduced(nextKey,'E0'))
            .mul(getComputed(nextKey,'P_effect'))
            if(getChallengeDifficulty('o1','C1')){//myopia penalty
               var m = getThingAmount('o1','m')
               ;(m[0]===layerKey&&m[1]==='G0')||(mult.gt(TEN)&&(mult = mult.log10().sqrt().pow10()))
            }
            if(getChallengeDifficulty('o1','C3')){//antimatter penalty
               mult = mult.mul(getComputed('o1','a_mult'))
            }
            return mult
         }}],
         ['E0',{type:'produced',description:()=>'You have '+format(getProduced(layerKey,'E0'))+
            ' '+Notation.display(expr)+' energy (+ '+format(getComputed(layerKey,'E0_speed'))+'/s)'+
            (n>1?', multiplying '+Notation.displayShort(prevExpr)+' production by ':', multiplying number production by ')+
            format(ONE.add(getProduced(layerKey,'E0')))
         }],
         ['E0_speed',{type:'computed',calc:()=>getComputed(layerKey,'G0_mult').mul(getBuyable(layerKey,'G0'))}],
      ]),
      auto:n>1?[prevKey,'U0','U1']:['','U0'],
      layout:{
         colors:'cell1',
         P:true,
         upgrades:[['U0','U1']],
         buyables:[[['G0']]],
         buyableTexts:['E0'],
      },
      production:dt=>{
         setThingAmount(layerKey,'E0',getComputed(layerKey,'E0_speed').mul(dt).add(getProduced(layerKey,'E0')))
      },
   }
}})