var applyLogs = (x,n)=>{
   var i=n
   while(i--) x = ONE.add(x).log10()
   return x
}
var autobuyerPool=new Set(), autoprestigerPool=new Set()
var hasAutobuyer = layerKey=>{
   var thingKey = layers[layerKey]?.auto?.[1]
   return typeof thingKey==='string'&&hasUpgrade(layerKey,thingKey)
}
var hasAutoprestiger = layerKey=>{
   var thingKey = layers[layerKey]?.auto?.[2]
   return typeof thingKey==='string'&&hasUpgrade(layerKey,thingKey)
}
var addAutobuyer = layerKey=>{
   if(autobuyerPool.has(layerKey)) return;
   autobuyerPool.add(layerKey)
   var expr = Notation.parse(layerKey)
   var lower = player.A.map((x,i)=>[Notation.parse(x[0]),i])
   .reduce((p,e)=>Notation.compare(e[0],expr)>0?p:Notation.compare(p[0],e[0])>0?p:e,[[],-1])
   if(~lower[1]){
      player.A.splice(lower[1]+1,0,[layerKey,1,player.A[lower[1]][2],[]])
   }else{
      player.A.push([layerKey,1,0,[]])
   }
}
var addAutoprestiger = layerKey=>{
   if(autoprestigerPool.has(layerKey)) return;
   autoprestigerPool.add(layerKey)
   var expr = Notation.parse(layerKey)
   var lower = player.a.map((x,i)=>[Notation.parse(x[0]),i])
   .reduce((p,e)=>Notation.compare(e[0],expr)>0?p:Notation.compare(p[0],e[0])>0?p:e,[[],-1])
   var item
   if(~lower[1]){
      item = JSON.parse(JSON.stringify(player.a[lower[1]]))
      item[0] = layerKey
      player.a.splice(lower[1]+1,0,item)
   }else{
      item = [layerKey,1,0,layerKey,0,layerKey,[0,0],Array(11).fill(0)]
      player.a.push(item)
   }
}
var autoBuyOn = (layerKey,ratio=0,priors=[])=>{
   var things = getLayerThings(layerKey)
   priors.forEach((thingKey)=>{
      switch(things.get(thingKey)?.type){
      case 'upgrade': return buyUpgrade(layerKey,thingKey)
      case 'buyable': return getBuyable(layerKey,thingKey)||buyBuyable(layerKey,thingKey)
      }
   })
   var pointKept = Decimal.mul(getPointTotal(layerKey),ratio)
   var counts = 0, list = []
   things.forEach((thing,key)=>{
      switch(thing.type){
      case 'buyable':
         ++counts
      case 'upgrade':
         list.push([thing.type,key])
      }
   })
   list.forEach(([type,thingKey])=>{
      var availPoint = Decimal.sub(getPoint(layerKey),pointKept)
      if(availPoint.lt(ZERO)) return;
      if(type==='upgrade') return canBuyUpgrade(layerKey,thingKey,availPoint)&&buyUpgrade(layerKey,thingKey)
      buymaxBuyable(layerKey,thingKey,availPoint.div(counts))
      ;--counts
   })
}
var executeSingleAutobuyer = item=>{
   if(!item[1]||!hasAutobuyer(item[0])) return;
   var working = layers[item[0]].auto?.[0]
   switch(typeof working){
   case 'string': return autoBuyOn(working,item[2],item[3])
   case 'function':
      return autoBuyOn(layerKeys.slice(layerKeys.indexOf(item[0])+1).find(
         l=>working(l)&&ONE.lte(getPointTotal(l))
      ),item[2],item[3])
   }
}
var executeAutobuyers = ()=>player.A.forEach(executeSingleAutobuyer)
var testTrigger = (layerKey,item)=>{
   if(!canPrestige(layerKey)) return false
   var left,right,another
   var has3rd = item[4]&1
   switch(item[4]>>1){
   case 0:
      left = getPointGain(layerKey)
      right = new Decimal(getPointTotal(layerKey))
      if(has3rd) another = new Decimal(getPointTotal(item[5]))
      break
   case 1:
      left = getPointGain(layerKey)
      right = new Decimal(player.L[layerKey].r||0)
      if(has3rd) another = new Decimal(player.L[item[5]].r||0)
      break
   case 2:
      left = player.L[layerKey].t||0
      right = new Decimal(player.L[layerKey].r||0)
      if(has3rd) another = new Decimal(player.L[item[5]].r||0)
      break
   case 3:
      left = player.L[item[5]].r||0
      right = new Decimal(player.L[layerKey].r||0)
   }
   left = applyLogs(left,item[6][0])
   right = applyLogs(right,item[6][1])
   if(has3rd) another = applyLogs(another,item[6][1])
   var lgright = ONE.add(right).log10()
   var term0 = item[7][0]
   var term1 = right.mul(item[7][1])
   var term2 = lgright.mul(item[7][2])
   var term3 = right.mul(lgright).mul(item[7][3])
   if(has3rd){
      var lganother = ONE.add(another).log10()
      var term4 = another.mul(item[7][4])
      var term5 = right.mul(another).mul(item[7][5])
      var term6 = lganother.mul(item[7][6])
      var term7 = lgright.mul(lganother).mul(item[7][7])
      var term8 = another.mul(lganother).mul(item[7][8])
      var term9 = right.mul(lganother).mul(item[7][9])
      var term10 = another.mul(lgright).mul(item[7][10])
      return term1.add(term0).add(term2).add(term3).add(term4).add(term5).add(term6).add(term7).add(term8).add(term9).add(term10).lte(left)
   }
   return term1.add(term0).add(term2).add(term3).lte(left)
}
var getTriggered = (item)=>{//undefined when nothing triggered
   var working = layers[item[0]].auto?.[0]
   if(typeof working==='function'){
      return layerKeys.slice(layerKeys.indexOf(item[0])+1).find(layerKey=>working(layerKey)&&testTrigger(layerKey,item))
   }else{
      return testTrigger(working,item)?working:undefined
   }
}
var executeAutoprestigers = ()=>{
   var r,working,remembered=[]//each is [type,targetlayer,otheritemBoughtlayer,notSkipping]
   var items=player.a,item
   ,len=items.length,i
   ,target,flag
   for(i=0;i<len;++i){
      item=items[i]
      //handle ending of mode 2~5
      for(r=0;r<remembered.length;){
         working = remembered[r]
         if(working[2]===item[0]){
            if(working[0]>=2&&working[3]) return prestige(working[1])
            remembered.splice(r,1)
         }
         else ++r
      }
      if(!item[1]||!hasAutoprestiger(item[0])) continue
      if(remembered.some(working=>!working[3])) continue
      //is this above/below trigger?
      flag = (target=getTriggered(item))!==undefined
      if(flag){
         if(!item[2]) return prestige(target)
         for(r=0;r<remembered.length;){
            working = remembered[r]
            if(working[0]===1) remembered.splice(r,1)
            else if(getPointGain(working[1]).mul(getPointTotal(target)).lt(getPointGain(target).mul(getPointTotal(working[1])))){
               remembered.splice(r,1)
            }else ++r
         }
      }else{
         for(r=0;r<remembered.length;++r){
            working = remembered[r]
            if((working[0]&1)&&working[3]) return prestige(working[1])
         }
      }
      if(item[2]&&(item[2]<=3||flag)) remembered.push([item[2],target,item[3],flag])
   }
   remembered.some(working=>{
      if(!working[3]) return false
      prestige(working[1])
      return true
   })
}
/*player.A is autobuyer pool = [single term,...], execute in order
 *player.a is autoprestiger pool = [single term,...], execute in order
 * where every single term is [] with property
 * [0]:String, the layerKey (of this automation bought from)
 * [1]:Number, 0=off 1=on
 * autobuyer[2]:Number, keeping point ratio (0~1)
 * autobuyer[3]:Array of String, priored buying item before applying buy max ratio
 * autoprestige[2]: autoprestige mode
 *    mode 0=immediate
 *    1=fire if next item below trigger; if this below trigger then skip to another item
 *    2=compare multiplier until another item (if this is biggest then fire); if this below trigger then skip to the "another item"
 *    3=compare multiplier until another item or a failed item; if this below trigger then skip to the "another item"
 *    4=compare multiplier until another item (if this is biggest then fire); below trigger - just go next item
 *    5=compare multiplier until another item or a failed item; below trigger - just go next item
 * autoprestige[3]: the "another item" of mode 1~3
 * autoprestige[4] bit0: trigger condition formula (each lg should be x=>lg(1+x))
 *    formula 0: (2 inputs, 4 param) left >= a0 + a1*right + a2*lg(right) + a3*right*lg(right)
 *    formula 1: (3 inputs, 11 param) left >= a0 + a1*right + a4*another + a5*right*another +
 *    a2*lg(right) + a6*lg(another) + a7*lg(right)*lg(another) +
 *    a3*right*lg(right) + a8*another*lg(another) + a9*right*lg(another) + a10*another*lg(right)
 * autoprestige[4]: trigger condition inputs
 *    0~1 gain total anotherTotal
 *    2~3 gain reset anotherReset
 *    4~5 time reset anotherReset
 *    6 anotherReset reset
 * autoprestige[5]: "another" source
 * autoprestige[6]: log levels [left,right]
 * autoprestige[7]: trigger parameter list
*/
var autobuyerSelected = Vue.ref([])
var autobuyerSelectIndex = Vue.ref(-1)
var autobuyerMove = n=>{
   if(autobuyerSelectIndex.value<0||autobuyerSelectIndex.value>=player.A.length) return;
   if(autobuyerSelectIndex.value+n<0) n=-autobuyerSelectIndex.value
   if(autobuyerSelectIndex.value+n>=player.A.length) n=player.A.length-1-autobuyerSelectIndex.value
   player.A.splice(autobuyerSelectIndex.value,1)
   player.A.splice(autobuyerSelectIndex.value+=n,0,autobuyerSelected.value)
}
var abTargetLayerText = Vue.computed(()=>{
   var working = layers[autobuyerSelected.value[0]].auto?.[0]
   return typeof working==='string'?
   working===''?'&nbsp; It buys number generators'
   :'&nbsp; It buys things in '+getLayerFullname(working)
   :undefined
})
var abCurrentWorking = Vue.computed(()=>{
   var a = layers[autobuyerSelected.value[0]].auto[0]
   if(typeof a==='string') return a
})
var abThingPool = Vue.computed(()=>abCurrentWorking.value!==undefined?
   Array.from(getLayerThings(abCurrentWorking.value))
   .filter(pair=>pair[1].type==='upgrade'||pair[1].type==='buyable')
   :[])
var abThingPoolSelected = Vue.ref([])
var autoprestigerSelected = Vue.ref([])
var autoprestigerSelectIndex = Vue.ref(-1)
var autoprestigerMove = n=>{
   if(autoprestigerSelectIndex.value<0||autoprestigerSelectIndex.value>=player.a.length) return;
   if(autoprestigerSelectIndex.value+n<0) n=-autoprestigerSelectIndex.value
   if(autoprestigerSelectIndex.value+n>=player.a.length) n=player.a.length-1-autoprestigerSelectIndex.value
   player.a.splice(autoprestigerSelectIndex.value,1)
   player.a.splice(autoprestigerSelectIndex.value+=n,0,autoprestigerSelected.value)
}
var apTargetLayerText = Vue.computed(()=>{
   var working = layers[autoprestigerSelected.value[0]].auto?.[0]
   return typeof working==='string'?'&nbsp; The target layer is '+getLayerFullname(working):undefined
})
var apFormulaLRR = Vue.computed(()=>{
   var mode = autoprestigerSelected.value[4]
   return [
      mode<=3?"target layer's points gain":
      mode<=5?'time/s in target layer':
      getLayerShortname(autoprestigerSelected.value[5])+' prestiges',
      mode<=1?"total points":"prestiges",
      mode===1?'total '+getLayerShortname(autoprestigerSelected.value[5])+'P':
      getLayerShortname(autoprestigerSelected.value[5])+' prestiges'
   ]
})
var applyLogText = (x,n)=>n>1?'lg'+('⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(n))+'(1+'+x+')':n?'lg(1+'+x+')':x
var apFormulaInputs = Vue.ref(Array(11).fill(0))
var update_apInputs = ()=>{
   Object.assign(apFormulaInputs.value,autoprestigerSelected.value[7])
}
var invUpdate_apInputs = (n)=>{
   var num = new Decimal(apFormulaInputs.value[n])
   if(Decimal.isFinite(num)) autoprestigerSelected.value[7][n]=num
   update_apInputs()
}