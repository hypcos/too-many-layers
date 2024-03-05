var notations={}
/*each notation in NOTATIONS: type_name:{shortID,true_name,...others_in_Notation_Explorer}*/
,lowest_FS_term_exceed = (expr,need_to_exceed,notation)=>{
   var res,n=0
   while(true){
      res = notation.FS(expr,n)
      if(notation.compare(res,need_to_exceed)>0) return res
      n++
   }
}
/*types of layers 1-1 map into notations*/
,to_layer_key = layer=>notations[layer?.type_name]?.shortID+'L'+layer?.expression
,from_layer_key = key=>{
   var a=key.split('L')
   for(var type in notations){
      if(notations[type].shortID===a[0]) break
   }
   return layers.find(layer=>layer.type_name===type&&layer.expression+''===a[1])
}