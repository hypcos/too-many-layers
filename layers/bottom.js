var pow2sumcost = x=>ONE.add(x).mul(HALF).mul(x).round()
,pow2invSumcost = y=>Decimal.mul(y,8).add(TWO).sqrt().add(NEGONE).mul(HALF).floor()
,pow2cost = x=>ONE.add(x)
,pow2invCost = y=>NEGONE.add(y).round()
,pow3sumcost = x=>{
   var x1 = ONE.add(x)
   return x1.mul(1/9).mul(x1).mul(x1).round()
}
,pow3invSumcost = y=>Decimal.mul(y,9).add(TWO).pow(1/3).add(NEGONE).floor()
,pow3cost = x=>ONE.add(x).mul(TWO.add(x)).mul(1/3).add(1/9).round()
,pow3invCost = y=>Decimal.mul(y,12).add(TWO).sqrt().add(-3).mul(HALF).floor()
,pow4sumcost = x=>{
   var n3 = Decimal.add(x,3).mul(x)
   return n3.add(4).mul(1/36).mul(n3).round()
}
,pow4invSumcost = y=>Decimal.mul(y,9).add(TWO).sqrt().mul(8).add(ONE).sqrt().add(-3).mul(HALF).floor()
,pow4cost = x=>{
   var x1 = TWO.add(x)
   return x1.mul(1/9).mul(x1).mul(x1).round()
}
,pow4invCost = y=>Decimal.mul(y,9).add(TWO).pow(1/3).add(NEGTWO).floor()
layerFactories.push({accept:expr=>!expr.length,output:()=>({
   things:new Map([
      ['P',{shortname:' '}],
      ['G',{
         type:'buyable',
         costs:[{
            sumcost:x=>pow4sumcost(x).mul(TWO.pow(getThingAmount('o1','p')?.['']?.G||ZERO)).round(),
            invSumcost:y=>pow4invSumcost(HALF.pow(getThingAmount('o1','p')?.['']?.G||ZERO).mul(y)),
            cost:x=>pow4cost(x).mul(TWO.pow(getThingAmount('o1','p')?.['']?.G||ZERO)).round(),
            invCost:y=>pow4invCost(HALF.pow(getThingAmount('o1','p')?.['']?.G||ZERO).mul(y)),
         }],
         fullname:'Number generator',
         tooltip:'Cost formula: round((2+amount)^3/9)',
      }],
      ['G_mult',{type:'computed',calc:()=>{
         var mult = ONE.add(getProduced('1','E0'))
         .mul(getComputed('1','P_effect'))
         if(getChallengeDifficulty('o1','C1')){//myopia penalty
            var m = getThingAmount('o1','m')
            ;(m[0]===''&&m[1]==='G')||(mult.gt(TEN)&&(mult = mult.log10().sqrt().pow10()))
         }
         if(getChallengeDifficulty('o1','C3')){//antimatter penalty
            mult = mult.mul(getComputed('o1','a_mult'))
         }
         return mult
      }}],
      ['P_speed',{type:'computed',calc:()=>getComputed('','G_mult').mul(getBuyable('','G'))}],
   ]),
   production:dt=>{
      var incr = getComputed('','P_speed').mul(dt)
      setThingAmount('','P',incr.add(getPoint('')))
      setThingAmount('','',incr.add(getPointTotal('')))
   },
   initial:{P:1,['']:1},
})})