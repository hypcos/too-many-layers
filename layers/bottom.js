var invXpowX = Y=>{
   var lnY,x,x1,lnx
   if(Decimal.lte(Y,0.6922006275553464)) return Decimal.dNaN
   if(Decimal.lt(Y,5)){
      var y = +Y
      x = Math.sqrt(y)
      do{
         x1 = x
         x -= (1-y/x**x)/(1+Math.log(x))
      }while(Math.abs(x1-x)>6e-16*(x1+x));
      return new Decimal(x)
   }
   if(Decimal.pow10(1e307).gt(Y)){
      lnY = +(Decimal.ln(Y))
      x = lnY/Math.log(lnY)
      do{
         x1 = x
         lnx = Math.log(x)
         x -= (x*lnx-lnY)/(1+lnx)
      }while(Math.abs(x1-x)>6e-16*(x1+x));
      return new Decimal(x)
   }
   if(Y.layer<=2){
      lnY = Y.ln()
      x = lnY.div(lnY.ln())
      do{
         x1 = x
         lnx = x.ln()
         x = x.sub(x.mul(lnx).sub(lnY).div(ONE.add(lnx)))
      }while(!x.eq_tolerance(x1,1e-15));
      return x
   }
   if(Y.layer<=3){
      lnY = Y.ln()
      return lnY.div(lnY.ln())
   }
   return Y.ln()
}
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
            sumcost:x=>pow4sumcost(x).mul(pricePenalty('','G')),
            invSumcost:y=>pow4invSumcost(invPricePenalty('','G').mul(y)),
            cost:x=>pow4cost(x).mul(pricePenalty('','G')),
            invCost:y=>pow4invCost(invPricePenalty('','G').mul(y)),
         }],
         fullname:'Number generator',
         tooltip:'Cost formula: round((2+amount)^3/9)',
      }],
      ['G_mult',{type:'computed',calc:()=>{
         var mult = ONE.add(getProduced('1','E0'))
         .mul(getComputed('1','P_effect')||ONE)
         //challenge penalty
         mult = applyMyopiaPenalty('','G',mult)
         mult = antimatterPenalty().mul(mult)
         return mult
      }}],
      ['P_speed',{type:'computed',calc:()=>(getComputed('','G_mult')||ONE).mul(getBuyable('','G'))}],
   ]),
   production:dt=>{
      var incr = (getComputed('','P_speed')||ZERO).mul(dt)
      setThingAmount('','P',incr.add(getPoint('')))
      setThingAmount('','',incr.add(getPointTotal('')))
   },
   initial:{P:1,['']:1},
})})