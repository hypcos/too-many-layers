var Notation,notations=[]
var lowest_FS_term_exceed = (expr,need_to_exceed,FS,compare)=>{
   var res,n=0
   while(true){
      res = FS(expr,n)
      if(compare(res,need_to_exceed)>0) return res
      n++
   }
}
,getBetween = (lower,higher,FS,compare,isLimit,decrement)=>{
   var res=[],working=higher
   while(compare(working=isLimit(working)?lowest_FS_term_exceed(working,lower,FS,compare):decrement(working),lower)>0){
      res.unshift(working)
   }
   return res
}
//some kinds of ingredient notations
var sequences=[]
,sequence_compare = (seq1,seq2)=>{
   if(seq1.length===0){
      if(seq2.length===0) return 0
      else return -1
   }else{
      if(seq2.length===0) return 1
      else{
         if(seq1[0]<seq2[0]) return -1
         else if(seq1[0]>seq2[0]) return 1
         else return sequence_compare(seq1.slice(1),seq2.slice(1))
      }
   }
}
,shorten_sequence = expr=>{
   var cuts=[]
   var n=0,width,count
   while(n<expr.length-1){
      width = expr.slice(n+1).findIndex(e=>e<=expr[n])+1
      if(!width) break
      count=1
      while(expr.slice(n,n+width)+''===expr.slice(n+width*count,n+width*(count+1))+'') ++count
      if(width===1?count>2:count>1){
         cuts.push({seq:[expr[n]].concat(shorten_sequence(expr.slice(n+1,n+width))),count:count})
      }else{
         cuts = cuts.concat(expr.slice(n,n+width*count))
      }
      n += width*count
   }
   return cuts.concat(expr.slice(n))
}
,shorten_to_string = s=>s.map(e=>
   ({}).toString.call(e)==='[object Object]'
   ?'('+shorten_to_string(e.seq)+')<sup>'+e.count+'</sup>'
   :e).join()
,registerSequence = x=>{
   sequences.push(Object.assign({
      compare:sequence_compare,
      ZERO:[],
      isZero:seq=>!seq.length,
      isLimit:seq=>seq[seq.length-1]>1,
      increment:seq=>seq.concat(1),
      decrement:seq=>seq.slice(0,-1),
      parse:str=>str.split(',').map(e=>+e),
      invParse:seq=>seq.join(),
      display:seq=>shorten_to_string(shorten_sequence(seq)),
   },x))
}
var nested_sequence_compare = (seq1,seq2)=>{
   if(typeof seq1==='number'){
      if(typeof seq2==='number') return Math.sign(seq1-seq2)
      return -1
   }
   if(typeof seq2==='number') return 1
   if(seq1.length===0){
      if(seq2.length===0) return 0
      return -1
   }
   if(seq2.length===0) return 1
   var cmp = nested_sequence_compare(seq1[0],seq2[0])
   if(cmp) return cmp
   return nested_sequence_compare(seq1.slice(1),seq2.slice(1))
}
//salad
var saladSum = (center,...args)=>{
   if(!(center>=0&&center<args.length)) center=-1
   var displayed_prefixs = args.map(e=>e.layerPrefix)
   ,displayed_short_prefixs = args.map(e=>e.layerShortPrefix)
   ,prefixs = args.map(e=>e.entryMark)
   return {
      FS:(expr,FSterm)=>{
         if(expr+''==='Infinity') return [FSterm,args[FSterm%args.length].ZERO]
         if(expr[0]&&args[expr[0]%args.length].isZero(expr[1])){
            if(expr[0]) return [expr[0]-1, args[(expr[0]-1)%args.length].FS([Infinity],FSterm)]
            return expr
         }
         return [expr[0], args[expr[0]%args.length].FS(expr[1],FSterm)]
      },
      compare:(a,b)=> a[0]===b[0] ? args[a[0]%args.length].compare(a[1],b[1]) : Math.sign(a[0]-b[0]),
      ZERO:[0,args[0].ZERO],
      isZero:expr=> !expr[0] && args[0].isZero(expr[1]),
      isLimit:expr=> expr+''==='Infinity'
         || args[expr[0]%args.length].isLimit(expr[1])
         || (expr[0] && args[expr[0]%args.length].isZero(expr[1])),
      increment:expr=>[expr[0],args[expr[0]%args.length].increment(expr[1])],
      decrement:expr=>[expr[0],args[expr[0]%args.length].decrement(expr[1])],
      parse:layerKey=>{
         var idx = prefixs.findIndex(e=>layerKey.includes(e))
         if(idx===-1) idx = ~center&&center
         var i = layerKey.indexOf(prefixs[idx])
         ,cyc = i>0?+(layerKey.slice(0,i)):0
         return [idx+cyc*args.length, args[idx].parse(layerKey.slice(~i? i+prefixs[idx].length :0))]
      },
      invParse:expr=>(expr[0]<args.length?'':Math.floor(expr[0]/args.length)+'') +
         (expr[0]===center?'':prefixs[expr[0]%args.length]) +
         args[expr[0]%args.length].invParse(expr[1]),
      display:expr=>displayed_prefixs[expr[0]%args.length] +
         (typeof args[expr[0]%args.length].displayShort==='function' ?
         args[expr[0]%args.length].display(expr[1]) :
         'layer '+args[expr[0]%args.length].display(expr[1])),
      displayShort:expr=>displayed_short_prefixs[expr[0]%args.length] +
         (typeof args[expr[0]%args.length].displayShort==='function' ?
         args[expr[0]%args.length].displayShort(expr[1]) :
         'L'+args[expr[0]%args.length].display(expr[1])),
      layerPrefix:'Sum ',
      layerShortPrefix:'Σ',
      entryMark:prefixs.join(''),
   }
}
,saladProduct = (center,...args)=>{
   if(!(center>=0&&center<args.length)) center=-1
   var displayed_prefixs = args.map(e=>e.layerPrefix)
   ,displayed_short_prefixs = args.map(e=>e.layerShortPrefix)
   ,prefixs = args.map(e=>e.entryMark)
   var check_tail = expr=>{if(args[(expr.length-1)%args.length].isZero(expr[expr.length-1])) expr.pop()}
   var FS = (expr,FSterm)=>{
      if(expr+''==='Infinity') return Array(FSterm).fill(0).map((e,i)=>args[i%args.length].ZERO)
         .concat([args[FSterm%args.length].FS([Infinity],FSterm)])
      var idx = expr.findIndex((e,i)=>!args[i%args.length].isZero(e))
      if(idx===-1) return []
      var expr1 = expr.slice()
      expr1[idx] = args[idx%args.length].isLimit(expr[idx]) ?
         args[idx%args.length].FS(expr[idx],FSterm) :
         args[idx%args.length].decrement(expr[idx])
      if(idx) expr1[idx-1] = args[(idx-1)%args.length].FS([Infinity],FSterm)
      check_tail(expr1)
      return expr1
   }
   var compare = (a,b)=>{
      if(a+''==='Infinity'){
         if(b+''==='Infinity') return 0
         return 1
      }
      if(b+''==='Infinity') return -1
      var al = a.length
      if(al!==b.length) return Math.sign(al-b.length)
      if(!al) return 0
      --al
      var cmp = args[al%args.length].compare(a[al],b[al])
      if(cmp) return cmp
      return compare(a.slice(0,-1),b.slice(0,-1))
   }
   return {
      FS,
      compare,
      ZERO:[],
      isZero:expr=>!expr.length,
      isLimit:expr=> expr+''==='Infinity'
         || args[0].isLimit(expr[0])
         || (expr.length>1 && args[0].isZero(expr[0])),
      increment:expr=>expr.length ? [args[0].increment(expr[0])].concat(expr.slice(1)) : [args[0].increment(args[0].ZERO)],
      decrement:expr=>{
         var r = [args[0].decrement(expr[0])].concat(expr.slice(1))
         check_tail(r)
         return r
      },
      parse:layerKey=>{
         var arr = prefixs.map((pref,idx)=>
            layerKey.split(pref)
            .map(e=>e.length+pref.length)
            .reduce((a,x,i)=>a.concat(x+a[i]),[-pref.length])
            .slice(1,-1)
            .map(e=>[e,idx])
         ).flat().sort((a,b)=>a[0]-b[0])
         for(var i=0,idx=0,expr=[];layerKey.slice(idx);++i){
            if(i===center){
               expr[i] = args[i].parse(layerKey.slice(idx,arr[0]?.[0]??Infinity))
               idx = arr[0]?.[0]??Infinity
               continue
            }
            if(!(arr.length && i%args.length===arr[0][1])){
               expr[i] = args[i%args.length].ZERO
               continue
            }
            if(i<center){
               expr[i] = args[i].parse(layerKey.slice(idx,arr[0][0]))
               idx = (arr[0][0])+prefixs[arr[0][1]].length
               arr.shift()
            }
            if(i>center){
               expr[i] = args[i%args.length].parse(layerKey.slice(idx+prefixs[arr[0][1]].length,arr[1]?.[0]??Infinity))
               idx = arr[1]?.[0]??Infinity
               arr.shift()
            }
         }
         return expr
      },
      invParse:expr=>{
         var count=0
         return expr.map((e,i)=>{
            var notation = args[i%args.length]
            if(notation.isZero(e)){
               if(++count<args.length) return ''
               count = 0
               return notation.entryMark
            }
            count = 0
            return i<center?notation.invParse(e)+notation.entryMark:
               i===center?notation.invParse(e): notation.entryMark+notation.invParse(e)
         }).join('')
      },
      display:expr=>expr.map((e,i)=>args[i%args.length].isZero(e) ? '' : displayed_prefixs[i%args.length]+
         (typeof args[i%args.length].displayShort==='function' ? args[i%args.length].display(e) :
         'layer '+args[i%args.length].display(e))).reverse().join(' '),
      displayShort:expr=>expr.map((e,i)=>args[i%args.length].isZero(e) ? '' : displayed_short_prefixs[i%args.length]+
         (typeof args[i%args.length].displayShort==='function' ? args[i%args.length].displayShort(e) :
         'L'+args[i%args.length].display(e))).reverse().join(''),
      layerPrefix:'Product ',
      layerShortPrefix:'Π',
      entryMark:prefixs.join(''),
   }
}