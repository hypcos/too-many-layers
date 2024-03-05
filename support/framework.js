var layers = []
/*layers are sorted from higher to lower
each layer in LAYERS: {type_name, expression, point_info, upgrades, buyables, extras, modifiers, initial()=>player_subdata,...}
thing_info: {
   fullname,
   productions:[(dt)=>{target_obj,target_prop,increment},...] without the 4 trial,
   gain_mode,
   gain:(current_point)=>number without the 4 trial like modifier,
   cost:(amount)=>cost_number,
   sumcost,
   inv_sumcost
}
upgrades: {s,'yx':info,...} where s=1~8 means at most 2^s-1 boughts (except first row)
buyables: ()=>{id:info,...}
extras: ()=>{id:info,...} you cannot buy them; extras include AM=antimatter per second
modifiers: ()=>{name:()=>number,...} computed, not saved in player*/
,player = {}
/*player.a has many {K:layerKey, other_settings...}
player.C has many layerKey:highest_completion_difficulty
player.L has many layerKey:{P:point amount, T:total point amount,
   t:timestamp of previous or higher reset, r:resets since higher reset, r0:resets of this or lower layers
   U:upgrade_table, B:{buyable_id:buyable_amount,...}, E:{extra_id:extra_amount,...}}*/
,last_save = Date.now()
,tabs = {topleft:1}
,progress_texts = []
/*each text item: [target_text,percentage_text]*/
,point_gains = {}
/*point_gains[layerKey] is a number for a layer*/
,modifiers = {}
/*modifiers[layerKey] is {name:current_amount,...} for a layer*/
,upgrades = {}
/*upgrades[layerKey] works like player.L[layerKey].U but decoded*/
,decode_single_upgrade_sheet = (data,y0,x0,s)=>{
   var i,j
   if(isNaN(data)) return {}
   var sheet={}
   for(i=0;i<x0;++i){
      sheet['1'+(i+1)]=data%2
      data=Math.floor(data/2)
   }
   for(j=1;j<y0;++j){
      for(i=0;i<x0;++i){
         sheet[''+(j+1)+(i+1)]=data%2**s
         data=Math.floor(data/2**s)
      }
   }
   return sheet
}
,encode_single_upgrade_sheet = (sheet,y0,x0,s)=>{
   var i,j
   if(!sheet) return 0
   var data=0
   for(j=y0;--j;){
      for(i=x0;i--;){
         data*=2**s
         data+=sheet[''+(j+1)+(i+1)]||0
      }
   }
   for(i=x0;i--;){
      data*=2
      data+=sheet['1'+(i+1)]||0
   }
   return data
}
,decode_upgrade_sheet = ()=>{
   var upgrades = {}
   layers.forEach(layer=>{
      var sheet_type = layer.upgrades.s
      ,x0,y0
      ;[x0,y0] = [[7,7],[4,7],[4,5],[4,4],[3,4],[4,3],[3,3],[3,3]][sheet_type-1]
      upgrades[to_layer_key(layer)] = decode_single_upgrade_sheet(get_player_layer(layer)?.U,y0,x0,sheet_type)
   })
   return upgrades
}
,encode_upgrade_sheet = (upgrades)=>{
   var encoded_data = {}
   layers.forEach(layer=>{
      var sheet_type = layer.upgrades.s
      ,layerKey = to_layer_key(layer)
      ,x0,y0
      ;[x0,y0] = [[7,7],[4,7],[4,5],[4,4],[3,4],[4,3],[3,3],[3,3]][sheet_type-1]
      encoded_data[layerKey] = encode_single_upgrade_sheet(upgrades[layerKey],y0,x0,sheet_type)
   })
   return encoded_data
}
,get_player_layer = layer=>player.L[to_layer_key(layer)]
,run_thing_production = (thing_info,dt,am)=>thing_info?.productions&&thing_info.productions.forEach(production=>{
   var p = production(dt)
   if(Decimal.gt(am,1)) p.increment = Decimal.div(p.increment,am)
   p.obj[p.prop] = Decimal.mul(p.increment,dt).add(p.obj[p.prop])
})
,run_layer_production = (layer,dt,am)=>{
   var keys,obj,layerKey=to_layer_key(layer)
   if(layer?.upgrades){
      keys = Object.keys(layer.upgrades)
      keys.forEach(yx=>upgrades[layerKey]?.[yx]&&run_thing_production(layer.upgrades[yx],dt,am))
   }
   if(layer?.buyables){
      keys = Object.keys(obj=layer.buyables())
      keys.forEach(id=>player.L[layerKey]?.B[id]?.gt(0)&&run_thing_production(obj[id],dt,am))
   }
   if(layer?.extras){
      keys = Object.keys(obj=layer.extras())
      keys.forEach(id=>player.L[layerKey]?.E[id]?.gt(0)&&run_thing_production(obj[id],dt,am))
   }
   run_thing_production(layer?.point_info,dt,am)
}
,run_production = dt=>layers.forEach(layer=>run_layer_production(layer,dt,
   //Apply trial penalty
   player.c[ANTIMATTER_TRIAL][1] ? layers.map(layer=>{
      var layerdata = get_player_layer(layer)
      return layerdata ? Decimal.mul(layerdata.E.AM||0,(Date.now()-layerdata.t)*.001).add(1) : 1
   }).reduce((prev,e)=>prev.mul(e),Decimal.dOne) : 1
))
,calculate_layer_point_gain = layer=>{
   var gain
   ,mode=layer?.point_info?.gain_mode
   if(mode==='normal') gain = layer.point_info.gain()
   else if(mode==='static') gain = layer.point_info.gain(get_player_layer(layer)?.P)
   else if(mode==='static respec') gain = layer.point_info.gain(get_player_layer(layer)?.T)
   else return Decimal.dZero
   //Apply trial penalty
   if(Decimal.gt(gain,1)&&player.c[SCARCITY_TRIAL][1]){
      gain = Decimal.pow(gain,new Decimal(100).div(Decimal.pow10(player.c[SCARCITY_TRIAL][1]).plus(99)))
   }
   if(player.c[TAX_TRIAL][1]){
      gain = Decimal.mul(gain,new Decimal(.95).pow(Decimal.mul(3**(player.c[TAX_TRIAL][1]-1),get_player_layer(layer)?.r0||0)))
   }
   if(player.c[POISON_TRIAL][1]){
      gain = Decimal.div(gain,Decimal.max(get_player_layer(layer)?.P||0,1))
   }
   return Decimal.max(gain,0)
}
,update_point_gain = ()=>layers.slice().reverse().forEach(layer=>point_gains[to_layer_key(layer)] = calculate_layer_point_gain(layer))
,update_modifiers = ()=>layers.forEach(layer=>{
   if(!layer?.modifiers) return;
   var layerKey=to_layer_key(layer)
   ,obj = layer.modifiers()
   if(!modifiers[layerKey]) modifiers[layerKey] = {}
   Object.keys(obj).forEach(name=>modifiers[layerKey][name] = obj[name]())
})
,gameloop = dt=>{
   run_production(dt)
   update_modifiers()
   update_point_gain()
   //do some automation, then update
   if(Date.now()-last_save>=player.si){
      //save()
      last_save=Date.now()
   }
}
,reset_thing_production = thing_info=>thing_info?.productions&&thing_info.productions.forEach(production=>{
   var p = production(1)
   p.obj[p.prop] = Decimal.dZero
})
,reset_layer_production = layer=>{
   var keys,obj,layerKey=to_layer_key(layer)
   if(layer?.upgrades){
      keys = Object.keys(layer.upgrades)
      keys.forEach(yx=>upgrades[layerKey]?.[yx]&&reset_thing_production(layer.upgrades[yx]))
   }
   if(layer?.buyables){
      keys = Object.keys(obj=layer.buyables())
      keys.forEach(id=>player.L[layerKey]?.B[id]?.gt(0)&&reset_thing_production(obj[id]))
   }
   if(layer?.extras){
      keys = Object.keys(obj=layer.extras())
      keys.forEach(id=>player.L[layerKey]?.E[id]?.gt(0)&&reset_thing_production(obj[id]))
   }
   reset_thing_production(layer?.point_info)
}
,reset_single_layer = (layer,tax,poison)=>{
   var layerKey=to_layer_key(layer)
   ,old_points = player.L[layerKey]?.P||0
   reset_layer_production(layer)
   player.L[layerKey] = layer.initial()
   if(tax>0&&Decimal.gt(old_points,10)) player.L[layerKey].P = Decimal.log10(old_points).pow(0.0625*2**tax).floor()
   if(!poison) upgrades[layerKey]={}
}
,reset_layers_from = layer=>{
   var idx=layers.indexOf(layer)
   ,layerKey=to_layer_key(layer)
   if(!player.C[ANTIMATTER_TRIAL]?.[layerKey]) layers.slice(0,idx+1).forEach(reset_layer_production)
   layers.slice(idx+1).forEach(l=>reset_single_layer(l,player.C[TAX_TRIAL]?.[layerKey],player.C[POISON_TRIAL]?.[layerKey]))
}
,prestige = layer=>{
   var layerKey=to_layer_key(layer)
   ,layer_idx = layers.indexOf(layer)
   ,layerdata = get_player_layer(layer)
   if(!layerdata) layerdata = layer.initial()
   layerdata.P = Decimal.floor(point_gains[layerKey]).add(layerdata.P)
   layerdata.T = Decimal.floor(point_gains[layerKey]).add(layerdata.T)
   ++layerdata.r
   if(player.c[TAX_TRIAL][1]){
      ++layerdata.r0
      layers.slice(0,layers.indexOf(layer)).forEach(l=>{
         var layerdata=get_player_layer(l)
         if(!layerdata) layerdata = l.initial()
         ++layerdata.r0
      })
   }
   if(player.c[ANTIMATTER_TRIAL][1]){
      layerdata.E.AM = Decimal.div(point_gains[layerKey],Math.max(Date.now()-layerdata.t,1)*.01)
   }
   player.c.forEach((running,challenge)=>{
      if(!running[1]) return;
      var trigger_idx = layers.findIndex(l=>to_layer_key(l)===running[0])
      if(layer_idx>=trigger_idx){
         var completions = player.C[challenge]
         if(completions) completions[layerKey] = Math.max(completions[layerKey]||0,running[1])
      }
      if(layer_idx<=trigger_idx){
         player.c[challenge] = ['',0]
         if(challenge===TAX_TRIAL) layers.forEach(l=>get_player_layer(l).r0=0)
         if(challenge===ANTIMATTER_TRIAL) layers.forEach(l=>get_player_layer(l).E.AM=Decimal.dZero)
      }
   })
   reset_layers_from(layer)
   player.cq.forEach((difficulty,challenge)=>
      difficulty &&
      !player.c[challenge][1] &&
      (player.C[challenge][layerKey]||0)<difficulty &&
      (player.c[challenge]=[layerKey,difficulty] , player.cq[challenge]=0)
   )
   layerdata.t = Date.now()
}